# scripts/validate_vistorias.ps1
# Validação reprodutível do módulo Vistorias (backend)
# - POST via curl.exe --data-binary (evita problemas do Invoke-RestMethod com Content-Length em alguns cenários)
# - introspecção do OpenAPI (/docs/json) para montar payload mínimo (somente required)
# Evidência: replay_status (derivado apenas do event-log) == Vistoria.status (persistido)

param(
  [string]$BaseUrl = "http://127.0.0.1:3001",
  [int]$Limit = 200,
  [switch]$SkipProposalCreate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Has-Prop([object]$obj, [string]$name) {
  if ($null -eq $obj) { return $false }
  return ($obj.PSObject.Properties.Name -contains $name)
}

function Get-Prop([object]$obj, [string]$name) {
  if (Has-Prop $obj $name) { return $obj.$name }
  return $null
}

function Write-Section([string]$title) {
  Write-Host ""
  Write-Host "============================================================"
  Write-Host $title
  Write-Host "============================================================"
}

function Get-Json([string]$url) {
  return Invoke-RestMethod -Method GET -Uri $url
}

function Post-Json([string]$url, [object]$obj) {
  $json = ($obj | ConvertTo-Json -Depth 50 -Compress)
  $tmp = New-TemporaryFile
  try {
    [System.IO.File]::WriteAllText($tmp.FullName, $json, [System.Text.UTF8Encoding]::new($false))
    $out = curl.exe -sS -X POST $url -H "Content-Type: application/json" --data-binary "@$($tmp.FullName)"
    if (-not $out) { return $null }
    return ($out | ConvertFrom-Json)
  } finally {
    Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue
  }
}

function Resolve-Ref($openapi, [string]$ref) {
  if ([string]::IsNullOrWhiteSpace($ref)) { return $null }
  if (-not $ref.StartsWith("#/")) { return $null }

  $parts = $ref.Substring(2).Split("/")
  $node = $openapi
  foreach ($p in $parts) {
    if ($null -eq $node) { return $null }
    if (-not (Has-Prop $node $p)) { return $null }
    $node = $node.$p
  }
  return $node
}

function Get-PathObject($openapi, [string]$path) {
  if ($null -eq $openapi) { return $null }
  if (-not (Has-Prop $openapi "paths")) { return $null }
  $paths = $openapi.paths
  $prop = $paths.PSObject.Properties | Where-Object { $_.Name -eq $path } | Select-Object -First 1
  if ($null -eq $prop) { return $null }
  return $prop.Value
}

function Find-PathInOpenApi($openapi, [string]$needlePath) {
  if ($null -eq $openapi) { return $null }
  if (-not (Has-Prop $openapi "paths")) { return $null }

  $p = $openapi.paths.PSObject.Properties | ForEach-Object { $_.Name }
  foreach ($x in $p) { if ($x -eq $needlePath) { return $x } }
  return $null
}

function Get-Schema-For-RequestBody($openapi, [string]$path, [string]$method) {
  $m = $method.ToLowerInvariant()
  $pathObj = Get-PathObject $openapi $path
  if ($null -eq $pathObj) { return $null }

  if (-not (Has-Prop $pathObj $m)) { return $null }
  $op = $pathObj.$m
  if ($null -eq $op) { return $null }

  $rb = Get-Prop $op "requestBody"
  if ($null -eq $rb) { return $null }

  $content = Get-Prop $rb "content"
  if ($null -eq $content) { return $null }

  $appJson = Get-Prop $content "application/json"
  if ($null -eq $appJson) { return $null }

  $schema = Get-Prop $appJson "schema"
  if ($null -eq $schema) { return $null }

  $ref = Get-Prop $schema '$ref'
  if ($ref) { return (Resolve-Ref $openapi $ref) }

  return $schema
}

function New-Minimal-ObjectFromSchema($openapi, $schema, $overrides) {
  if ($null -eq $schema) { return @{} }

  $ref = Get-Prop $schema '$ref'
  if ($ref) { $schema = Resolve-Ref $openapi $ref }
  if ($null -eq $schema) { return @{} }

  $obj = @{}

  $required = @()
  $req = Get-Prop $schema "required"
  if ($null -ne $req) { $required = @($req) }

  $props = Get-Prop $schema "properties"
  if ($null -eq $props) { return $obj }

  foreach ($name in $required) {
    $p = $null
    if (Has-Prop $props $name) { $p = $props.$name }

    if ($null -eq $p) {
      $obj[$name] = $null
      continue
    }

    $pRef = Get-Prop $p '$ref'
    if ($pRef) { $p = Resolve-Ref $openapi $pRef }

    if ($overrides -and $overrides.ContainsKey($name)) {
      $obj[$name] = $overrides[$name]
      continue
    }

    $enum = Get-Prop $p "enum"
    if ($null -ne $enum) {
      $arr = @($enum)
      if ($arr.Count -gt 0) { $obj[$name] = $arr[0]; continue }
    }

    $t = Get-Prop $p "type"
    $fmt = Get-Prop $p "format"

    if ($t -eq "string") {
      if ($fmt -eq "uuid") { $obj[$name] = "00000000-0000-0000-0000-000000000000"; continue }
      if ($fmt -eq "date-time") { $obj[$name] = (Get-Date).ToString("o"); continue }
      if ($fmt -eq "date") { $obj[$name] = (Get-Date).ToString("yyyy-MM-dd"); continue }
      $obj[$name] = "MVP"
      continue
    }

    if ($t -eq "integer" -or $t -eq "number") { $obj[$name] = 0; continue }
    if ($t -eq "boolean") { $obj[$name] = $false; continue }
    if ($t -eq "array") { $obj[$name] = @(); continue }

    if ($t -eq "object") {
      $obj[$name] = New-Minimal-ObjectFromSchema $openapi $p @{}
      continue
    }

    $obj[$name] = $null
  }

  return $obj
}

function Extract-Enum($openapi, $schema, [string]$propName) {
  if ($null -eq $schema) { return @() }

  $ref = Get-Prop $schema '$ref'
  if ($ref) { $schema = Resolve-Ref $openapi $ref }
  if ($null -eq $schema) { return @() }

  $props = Get-Prop $schema "properties"
  if ($null -eq $props) { return @() }
  if (-not (Has-Prop $props $propName)) { return @() }

  $p = $props.$propName
  $pRef = Get-Prop $p '$ref'
  if ($pRef) { $p = Resolve-Ref $openapi $pRef }

  $enum = Get-Prop $p "enum"
  if ($null -eq $enum) { return @() }
  return @($enum)
}

function Guess-StatusFromEvents($events, $statusEnum) {
  if ($null -eq $events -or $events.Count -eq 0) { return $null }

  $sorted = $events | Sort-Object at
  $types = $sorted | ForEach-Object { $_.type }

  $candidates = @()
  if ($statusEnum -and $statusEnum.Count -gt 0) { $candidates = $statusEnum }
  else { $candidates = @("rascunho","agendada","executada","laudo_emitido") }

  if ($types -contains "issue_laudo" -or $types -contains "issue-laudo" -or $types -contains "issueLaudo") {
    $hit = $candidates | Where-Object { $_ -match "laud" }
    if ($hit) { return $hit[0] }
    return $candidates[-1]
  }

  if ($types -contains "execute") {
    $hit = $candidates | Where-Object { $_ -match "execut" }
    if ($hit) { return $hit[0] }
  }

  if ($types -contains "schedule") {
    $hit = $candidates | Where-Object { $_ -match "agend|sched" }
    if ($hit) { return $hit[0] }
  }

  if ($types -contains "create") {
    $hit = $candidates | Where-Object { $_ -match "rascun|draft|novo" }
    if ($hit) { return $hit[0] }
    return $candidates[0]
  }

  return $candidates[0]
}

Write-Section "1) Health + OpenAPI"
$health = Get-Json "$BaseUrl/healthz"
$health | ConvertTo-Json -Depth 10

$openapi = Get-Json "$BaseUrl/docs/json"

$P_AREAS = Find-PathInOpenApi $openapi "/v1/areas"
$P_PROPOSALS = Find-PathInOpenApi $openapi "/v1/proposals"
$P_PROPOSALS_MOVE = Find-PathInOpenApi $openapi "/v1/proposals/{id}/move"
$P_VISTORIAS = Find-PathInOpenApi $openapi "/v1/vistorias"
$P_VISTORIA_BY_ID = Find-PathInOpenApi $openapi "/v1/vistorias/{id}"
$P_VISTORIA_EVENTS = Find-PathInOpenApi $openapi "/v1/vistorias/{id}/events"
$P_VISTORIA_SCHEDULE = Find-PathInOpenApi $openapi "/v1/vistorias/{id}/schedule"
$P_VISTORIA_EXECUTE = Find-PathInOpenApi $openapi "/v1/vistorias/{id}/execute"
$P_VISTORIA_LAUDO = Find-PathInOpenApi $openapi "/v1/vistorias/{id}/issue-laudo"

if (-not $P_VISTORIAS) { throw "OpenAPI não contém /v1/vistorias. Verificar se API está no commit esperado." }

Write-Host "OK: paths detectados:"
@($P_AREAS,$P_PROPOSALS,$P_VISTORIAS,$P_VISTORIA_SCHEDULE,$P_VISTORIA_EXECUTE,$P_VISTORIA_LAUDO) | ForEach-Object { if ($_) { Write-Host " - $_" } }

Write-Section "2) Obter area_id + criar proposal (ou reutilizar)"
$areas = Get-Json "$BaseUrl/v1/areas?status=disponivel&ativo=true&limit=1&offset=0"
if ($null -eq $areas -or -not (Has-Prop $areas "items") -or $areas.items.Count -eq 0) {
  throw "Nenhuma área DISPONIVEL/ativa encontrada. Rodar seed/import antes."
}
$area = $areas.items | Select-Object -First 1
Write-Host "area_id=$($area.id)"

$proposal = $null
if ($SkipProposalCreate) {
  throw "SkipProposalCreate=ON não suportado neste modo (evita passo manual sem entrada interativa)."
} else {
  $proposal = Post-Json "$BaseUrl/v1/proposals" @{
    area_id = $area.id
    descricao_plano = "Plano de adoção (MVP): manutenção mensal, limpeza e jardinagem com cronograma e responsáveis."
    owner_role = "adotante_pf"
    actor_role = "adotante_pf"
    documentos = @()
  }
  if ($null -eq $proposal -or -not (Has-Prop $proposal "id") -or -not $proposal.id) { throw "Falha ao criar proposal." }
  Write-Host "proposal_id=$($proposal.id) codigo_protocolo=$($proposal.codigo_protocolo)"
}

if ($P_PROPOSALS_MOVE) {
  try {
    $moved = Post-Json "$BaseUrl/v1/proposals/$($proposal.id)/move" @{
      to = "analise_semad"
      actor_role = "gestor_semad"
      note = "Movimento automático (script validação vistorias)."
    }
    if ($moved -and (Has-Prop $moved "kanban_coluna") -and $moved.kanban_coluna) {
      Write-Host "proposal moved -> kanban_coluna=$($moved.kanban_coluna)"
    }
  } catch {
    Write-Host "Aviso: move de proposal falhou (pode ser esperado). Erro: $($_.Exception.Message)"
  }
}

Write-Section "3) Criar vistoria (payload mínimo via OpenAPI required)"
$schemaCreate = Get-Schema-For-RequestBody $openapi $P_VISTORIAS "post"
if ($null -eq $schemaCreate) {
  throw "OpenAPI não expõe requestBody para POST $P_VISTORIAS. Ajustar docs/rota."
}

$over = @{}
$over["proposal_id"] = $proposal.id
$over["actor_role"] = "gestor_semad"
$over["owner_role"] = "gestor_semad"
$over["at"] = (Get-Date).ToString("o")
$over["scheduled_at"] = (Get-Date).AddDays(2).ToString("o")

$vistoriaCreateBody = New-Minimal-ObjectFromSchema $openapi $schemaCreate $over
if ($vistoriaCreateBody.ContainsKey("proposal_id")) { $vistoriaCreateBody["proposal_id"] = $proposal.id }

$vistoria = Post-Json "$BaseUrl/v1/vistorias" $vistoriaCreateBody
if ($null -eq $vistoria -or -not (Has-Prop $vistoria "id") -or -not $vistoria.id) {
  Write-Host "Body enviado (debug):"
  $vistoriaCreateBody | ConvertTo-Json -Depth 20
  throw "Falha ao criar vistoria. Ver resposta do servidor (required/validations)."
}
Write-Host "vistoria_id=$($vistoria.id) status=$($vistoria.status)"

Write-Section "4) Validar replay_status após CREATE"
$events1 = Get-Json "$BaseUrl/v1/vistorias/$($vistoria.id)/events?limit=$Limit&offset=0"
$events1Items = @()
if ($events1 -and (Has-Prop $events1 "items") -and $events1.items) { $events1Items = @($events1.items) }

$statusEnum = @()
try {
  $components = Get-Prop $openapi "components"
  $schemas = if ($components) { Get-Prop $components "schemas" } else { $null }
  $vistoriaSchema = if ($schemas -and (Has-Prop $schemas "Vistoria")) { $schemas.Vistoria } else { $null }
  if ($vistoriaSchema) { $statusEnum = Extract-Enum $openapi $vistoriaSchema "status" }
} catch { }

$replay1 = Guess-StatusFromEvents $events1Items $statusEnum
Write-Host "replay_status=$replay1 api_status=$($vistoria.status)"
if ($replay1 -and $vistoria.status -and ($replay1 -ne $vistoria.status)) {
  Write-Host "MISMATCH (create): replay_status != api_status"
  exit 2
}

Write-Section "5) Schedule -> Execute -> Issue-Laudo (payload mínimo via OpenAPI required)"
function Call-Step([string]$pathTemplate, [string]$method, [hashtable]$defaults) {
  $path = $pathTemplate.Replace("{id}", $vistoria.id)
  $schema = Get-Schema-For-RequestBody $openapi $pathTemplate $method

  if ($null -eq $schema) {
    return (Post-Json "$BaseUrl$path" @{})
  }

  $body = New-Minimal-ObjectFromSchema $openapi $schema $defaults
  return (Post-Json "$BaseUrl$path" $body)
}

if ($P_VISTORIA_SCHEDULE) {
  $scheduled = Call-Step $P_VISTORIA_SCHEDULE "post" @{
    actor_role = "gestor_semad"
    scheduled_at = (Get-Date).AddDays(2).ToString("o")
    note = "Agendamento (script validação)."
    at = (Get-Date).ToString("o")
  }
  if ($scheduled -and (Has-Prop $scheduled "status") -and $scheduled.status) { $vistoria = $scheduled }
  else { $vistoria = Get-Json "$BaseUrl/v1/vistorias/$($vistoria.id)" }

  $events = Get-Json "$BaseUrl/v1/vistorias/$($vistoria.id)/events?limit=$Limit&offset=0"
  $items = @(); if ($events -and (Has-Prop $events "items") -and $events.items) { $items = @($events.items) }
  $replay = Guess-StatusFromEvents $items $statusEnum
  Write-Host "AFTER schedule: replay_status=$replay api_status=$($vistoria.status)"
  if ($replay -and $vistoria.status -and ($replay -ne $vistoria.status)) { Write-Host "MISMATCH (schedule)"; exit 3 }
} else {
  Write-Host "Aviso: rota schedule não encontrada no OpenAPI (skip)."
}

if ($P_VISTORIA_EXECUTE) {
  $executed = Call-Step $P_VISTORIA_EXECUTE "post" @{
    actor_role = "gestor_semad"
    executed_at = (Get-Date).AddDays(3).ToString("o")
    note = "Execução (script validação)."
    at = (Get-Date).ToString("o")
  }
  if ($executed -and (Has-Prop $executed "status") -and $executed.status) { $vistoria = $executed }
  else { $vistoria = Get-Json "$BaseUrl/v1/vistorias/$($vistoria.id)" }

  $events = Get-Json "$BaseUrl/v1/vistorias/$($vistoria.id)/events?limit=$Limit&offset=0"
  $items = @(); if ($events -and (Has-Prop $events "items") -and $events.items) { $items = @($events.items) }
  $replay = Guess-StatusFromEvents $items $statusEnum
  Write-Host "AFTER execute: replay_status=$replay api_status=$($vistoria.status)"
  if ($replay -and $vistoria.status -and ($replay -ne $vistoria.status)) { Write-Host "MISMATCH (execute)"; exit 4 }
} else {
  Write-Host "Aviso: rota execute não encontrada no OpenAPI (skip)."
}

if ($P_VISTORIA_LAUDO) {
  $laudo = Call-Step $P_VISTORIA_LAUDO "post" @{
    actor_role = "gestor_semad"
    note = "Laudo emitido (script validação)."
    at = (Get-Date).ToString("o")
    conclusao = "FAVORAVEL"
    resultado = "FAVORAVEL"
    observacoes = "Laudo MVP: condições atendidas."
  }
  if ($laudo -and (Has-Prop $laudo "status") -and $laudo.status) { $vistoria = $laudo }
  else { $vistoria = Get-Json "$BaseUrl/v1/vistorias/$($vistoria.id)" }

  $events = Get-Json "$BaseUrl/v1/vistorias/$($vistoria.id)/events?limit=$Limit&offset=0"
  $items = @(); if ($events -and (Has-Prop $events "items") -and $events.items) { $items = @($events.items) }
  $replay = Guess-StatusFromEvents $items $statusEnum
  Write-Host "AFTER issue-laudo: replay_status=$replay api_status=$($vistoria.status)"
  if ($replay -and $vistoria.status -and ($replay -ne $vistoria.status)) { Write-Host "MISMATCH (issue-laudo)"; exit 5 }
} else {
  Write-Host "Aviso: rota issue-laudo não encontrada no OpenAPI (skip)."
}

Write-Section "6) Resultado final"
Write-Host "OK: replay_status bateu com status em todas as etapas executadas."
Write-Host "vistoria_id=$($vistoria.id)"
Write-Host "proposal_id=$($proposal.id)"
exit 0