param(
  [string]$BaseUrl = "http://127.0.0.1:3001",
  [string]$AdotanteEmail = "adotante.teste@example.com",
  [string]$AdotantePassword = "NovaSenhaForte123!",
  [string]$SchemaPath = ".\prisma\schema.prisma",
  [int]$HealthMaxAttempts = 20,
  [int]$AreasLimit = 200
)

$ErrorActionPreference = "Stop"

# Garantir que roda a partir de apps/api
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Set-Location .. | Out-Null

Write-Host "BASE_URL=$BaseUrl"
Write-Host "PWD=$((Get-Location).Path)"
Write-Host ""

function Curl-Request {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST")] [string]$Method,
    [Parameter(Mandatory=$true)] [string]$Url,
    [hashtable]$Headers = @{},
    [hashtable]$BodyObj = $null
  )

  $outFile = New-TemporaryFile

  $args = @(
    "-sS",
    "-o", $outFile.FullName,
    "-w", "%{http_code}",
    "-X", $Method,
    $Url
  )

  foreach ($k in $Headers.Keys) {
    $args += @("-H", ("{0}: {1}" -f $k, $Headers[$k]))
  }

  $tmpBody = $null
  if ($BodyObj -ne $null) {
    $json = ($BodyObj | ConvertTo-Json -Depth 50 -Compress)
    $tmpBody = New-TemporaryFile
    [System.IO.File]::WriteAllText($tmpBody.FullName, $json, [System.Text.UTF8Encoding]::new($false))

    $args += @("-H", "Content-Type: application/json")
    $args += @("--data-binary", "@$($tmpBody.FullName)")
  }

  try {
    $code = & curl.exe @args
    $raw  = Get-Content $outFile.FullName -Raw
  } finally {
    Remove-Item $outFile.FullName -Force -ErrorAction SilentlyContinue
    if ($tmpBody) { Remove-Item $tmpBody.FullName -Force -ErrorAction SilentlyContinue }
  }

  $parsed = $null
  try { if ($raw) { $parsed = $raw | ConvertFrom-Json } } catch { $parsed = $raw }

  return [pscustomobject]@{
    status_code = [int]$code
    raw         = $raw
    body        = $parsed
  }
}

function Wait-Healthz {
  param([int]$MaxAttempts = 20)

  for ($i = 1; $i -le $MaxAttempts; $i++) {
    try {
      $r = Curl-Request -Method "GET" -Url "$BaseUrl/healthz"
      if ($r.status_code -eq 200 -and $r.body.ok -eq $true) {
        Write-Host "OK healthz (attempt $i)"
        return
      }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw "API não respondeu /healthz."
}

function Login-And-GetToken {
  param([string]$Email, [string]$Password)

  $r = Curl-Request -Method "POST" -Url "$BaseUrl/v1/auth/login" -BodyObj @{
    email    = $Email
    password = $Password
  }

  if ($r.status_code -ne 200 -or -not $r.body.access_token) {
    Write-Host "LOGIN_FALHOU HTTP=$($r.status_code)"
    Write-Host $r.raw
    throw "Login falhou para $Email"
  }

  return $r.body.access_token
}

function Register-Adotante {
  param([string]$Nome, [string]$Email, [string]$Password)

  $r = Curl-Request -Method "POST" -Url "$BaseUrl/v1/auth/register" -BodyObj @{
    nome     = $Nome
    email    = $Email
    password = $Password
    role     = "adotante_pf"
  }

  if ($r.status_code -ge 400) {
    Write-Host "REGISTER_FALHOU HTTP=$($r.status_code)"
    Write-Host $r.raw
    throw "Register falhou para $Email"
  }

  return $r
}

function Set-UserRole-ByEmail {
  param([string]$Email, [string]$Role)

  $sql = "update users set role = '$Role' where email = '$Email';"
  $tmpSql = New-TemporaryFile
  [System.IO.File]::WriteAllText($tmpSql.FullName, $sql, [System.Text.UTF8Encoding]::new($false))

  Write-Host "SET_ROLE: $Email -> $Role"
  & npx prisma db execute --schema $SchemaPath --file "$($tmpSql.FullName)" | Out-Host

  Remove-Item $tmpSql.FullName -Force -ErrorAction SilentlyContinue
}

function Create-Proposal-FirstWorkingArea {
  param([string]$AccessToken, [string]$Descricao)

  $areas = Curl-Request -Method "GET" -Url "$BaseUrl/v1/areas?status=disponivel&ativo=true&limit=$AreasLimit&offset=0"
  if ($areas.status_code -ne 200 -or -not $areas.body.items -or $areas.body.items.Count -lt 1) {
    Write-Host "AREAS_FALHOU HTTP=$($areas.status_code)"
    Write-Host $areas.raw
    throw "Sem áreas disponíveis (status=disponivel, ativo=true) ou falha ao listar."
  }

  foreach ($a in $areas.body.items) {
    $areaId = $a.id

    $r = Curl-Request -Method "POST" -Url "$BaseUrl/v1/proposals" `
      -Headers @{ Authorization = ("Bearer " + $AccessToken) } `
      -BodyObj @{
        area_id         = $areaId
        descricao_plano = $Descricao
        documentos      = @()
      }

    if ($r.status_code -eq 201 -and $r.body.id) {
      return [pscustomobject]@{ area_id = $areaId; proposal = $r.body }
    }

    if ($r.status_code -eq 409) { continue }

    Write-Host "CREATE_PROPOSAL_FALHOU area=$areaId HTTP=$($r.status_code)"
    Write-Host $r.raw
    throw "Falha inesperada ao criar proposal."
  }

  throw "Não foi possível criar proposal em nenhuma área retornada (provável: todas já têm proposta aberta)."
}

# ------------------ RUN ------------------
Wait-Healthz -MaxAttempts $HealthMaxAttempts
Write-Host ""

# A) Login adotante
$ACCESS_A = Login-And-GetToken -Email $AdotanteEmail -Password $AdotantePassword
Write-Host ("ACCESS_A_LEN=" + $ACCESS_A.Length)

$meA = Curl-Request -Method "GET" -Url "$BaseUrl/v1/me" -Headers @{ Authorization=("Bearer " + $ACCESS_A) }
Write-Host $meA.raw
Write-Host ""

# B) Criar proposal do adotante (garantido)
$desc = "RBAC fluxo SEMAD: descrição com mais de trinta caracteres para validar o mínimo."
$created = Create-Proposal-FirstWorkingArea -AccessToken $ACCESS_A -Descricao $desc
$AREA_ID     = $created.area_id
$PROPOSAL_ID = $created.proposal.id

Write-Host ("AREA_ID=" + $AREA_ID)
Write-Host ("PROPOSAL_ID=" + $PROPOSAL_ID)
Write-Host ""

# C) Criar usuário SEMAD e promover via prisma
$EMAIL_SEMAD    = "semad." + (Get-Date -Format "yyyyMMddHHmmss") + "@example.com"
$PASSWORD_SEMAD = "SenhaForte123!"

Register-Adotante -Nome "Gestor SEMAD" -Email $EMAIL_SEMAD -Password $PASSWORD_SEMAD | Out-Null
Write-Host ("CRIADO_SEMAD_EMAIL=" + $EMAIL_SEMAD)

Set-UserRole-ByEmail -Email $EMAIL_SEMAD -Role "gestor_semad"
Write-Host ""

# D) Login SEMAD (token deve refletir role novo)
$ACCESS_SEMAD = Login-And-GetToken -Email $EMAIL_SEMAD -Password $PASSWORD_SEMAD
Write-Host ("ACCESS_SEMAD_LEN=" + $ACCESS_SEMAD.Length)

$meS = Curl-Request -Method "GET" -Url "$BaseUrl/v1/me" -Headers @{ Authorization=("Bearer " + $ACCESS_SEMAD) }
Write-Host $meS.raw
Write-Host ""

if ($meS.body.role -ne "gestor_semad") {
  throw "SEMAD ainda não está como gestor_semad no /v1/me. Role atual: $($meS.body.role)."
}

# E) SEMAD lista proposals (staff: todas)
Write-Host "--- SEMAD GET /v1/proposals (list) ---"
$list = Curl-Request -Method "GET" -Url "$BaseUrl/v1/proposals?limit=50&offset=0" -Headers @{ Authorization=("Bearer " + $ACCESS_SEMAD) }
Write-Host ("HTTP=" + $list.status_code)
Write-Host $list.raw
Write-Host ""

# F) SEMAD lê proposal do adotante
Write-Host "--- SEMAD GET /v1/proposals/{A} ---"
$getP = Curl-Request -Method "GET" -Url "$BaseUrl/v1/proposals/$PROPOSAL_ID" -Headers @{ Authorization=("Bearer " + $ACCESS_SEMAD) }
Write-Host ("HTTP=" + $getP.status_code)
Write-Host $getP.raw
Write-Host ""

# G) SEMAD move protocolo -> analise_semad
Write-Host "--- SEMAD POST /v1/proposals/{A}/move to=analise_semad ---"
$move = Curl-Request -Method "POST" -Url "$BaseUrl/v1/proposals/$PROPOSAL_ID/move" `
  -Headers @{ Authorization=("Bearer " + $ACCESS_SEMAD) } `
  -BodyObj @{ to="analise_semad"; note="Iniciar análise SEMAD." }

Write-Host ("HTTP=" + $move.status_code)
Write-Host $move.raw
Write-Host ""

Write-Host "FIM."