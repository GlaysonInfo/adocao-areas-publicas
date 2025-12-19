// src/pages/PublicProgramPage.tsx
import { Link, useNavigate } from "react-router-dom";
import { isManagerRole, useAuth } from "../auth/AuthContext";

function todayBR() {
  try {
    return new Date().toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

export function PublicProgramPage() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const goAccess = () => {
    if (role) {
      navigate(isManagerRole(role) ? "/gestor/kanban" : "/areas", { replace: true });
      return;
    }
    navigate("/login", { replace: true });
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card pad">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>Bem-vindo(a)!</h2>
          <span style={{ opacity: 0.75 }}>
            Atualizado em <strong>{todayBR()}</strong> · Ambiente: <strong>protótipo (MVP)</strong>
          </span>
        </div>

        {/* 2 parágrafos objetivos */}
        <p>
          O programa <strong>ADOTE UMA ÁREA PÚBLICA</strong> promove a cooperação entre a Prefeitura de Betim e a sociedade
          para qualificar espaços públicos e áreas verdes do município, por meio de ações de manutenção, implantação,
          reforma e melhoria urbana, paisagística e ambiental — sempre conforme as regras municipais e o termo firmado.
        </p>
        <p>
          Pessoas físicas e jurídicas podem manifestar interesse selecionando uma área e enviando uma proposta com
          documentos básicos. A Prefeitura analisa (SEMAD/ECOS) e, quando aprovado, o processo segue para formalização
          e assinatura do termo. A adoção não concede uso exclusivo do espaço: ela regulamenta responsabilidades,
          contrapartidas e padrões de execução.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button className="btn--primary" type="button" onClick={goAccess}>
            Solicitar / Acessar o sistema
          </button>
          <Link className="btn" to="/areas">
            Ver áreas disponíveis
          </Link>
          <Link style={{ alignSelf: "center" }} to="/login">
            Já tenho perfil / Entrar
          </Link>
        </div>

        <hr className="hr" />

        <h2 style={{ marginTop: 0 }}>O que pode ser feito? Formas de adoção</h2>

        <div className="grid cols-2">
          <div className="card pad">
            <h3>I — Manutenção</h3>
            <ul style={{ margin: "8px 0 0 18px", color: "rgba(15,23,42,.76)" }}>
              <li>limpeza;</li>
              <li>jardinagem e irrigação;</li>
              <li>reparo e conservação de pavimentação, mobiliário urbano e infraestrutura;</li>
              <li>controle de pragas e doenças;</li>
              <li>conservação/recapeamento de pisos e áreas de circulação (passeio, rampa, escada, pista, ciclovia);</li>
              <li>limpeza e conservação de banheiros, vestiários e lavatórios (quando houver);</li>
              <li>outros serviços definidos no termo de cooperação.</li>
            </ul>
          </div>

          <div className="card pad">
            <h3>II — Implantação</h3>
            <p style={{ marginTop: 6 }}>
              Implementação de novo espaço público ou área verde em local desprovido de estrutura prévia
              ou com estrutura inadequada, insuficiente ou degradada (ex.: praça, parque, área kids, jardim, espaço pet).
            </p>
          </div>

          <div className="card pad">
            <h3>III — Reforma</h3>
            <p style={{ marginTop: 6 }}>
              Recuperação de espaços públicos ou de áreas verdes, podendo abranger a implantação de projetos paisagísticos.
            </p>
          </div>

          <div className="card pad">
            <h3>IV — Melhoria urbana, paisagística e ambiental</h3>
            <p style={{ marginTop: 6 }}>
              Projeto, obra, serviço, ação ou intervenção voltada ao cuidado do patrimônio público e à melhoria da
              qualidade de vida urbana, conforme regras do Município.
            </p>
          </div>
        </div>
      </section>

      <section className="card pad">
        <h2 style={{ marginTop: 0 }}>Como funciona (fluxo resumido do MVP)</h2>

        <div className="grid cols-3">
          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>1) Proposta</h3>
            <p style={{ marginTop: 6 }}>
              O interessado seleciona a área e envia a manifestação (carta de intenção), junto de proposta-resumo e documentos básicos.
            </p>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>2) Análise SEMAD</h3>
            <p style={{ marginTop: 6 }}>
              A Secretaria Municipal de Meio Ambiente e Desenvolvimento Sustentável analisa e emite parecer.
            </p>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>3) Ciência/Concordância ECOS</h3>
            <p style={{ marginTop: 6 }}>
              O processo segue para a ECOS (Gerência de Parques e Jardins) para ciência e concordância.
            </p>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>4) Decisão</h3>
            <p style={{ marginTop: 6 }}>
              Se houver discordância entre pareceres, a Secretaria Municipal de Governo decide.
              Se houver concordância, a SEMAD encaminha para formalização do termo (ou arquiva, se indeferido).
            </p>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>5) Termo assinado</h3>
            <p style={{ marginTop: 6 }}>
              Em caso de deferimento, o termo é apresentado ao adotante e segue para assinatura,
              habilitando a execução das intervenções previstas.
            </p>
          </div>
        </div>
      </section>

      <section className="card pad">
        <h2 style={{ marginTop: 0 }}>Benefícios da adoção</h2>

        <div className="grid cols-3">
          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>Fortalecimento da imagem e visibilidade</h3>
            <ul style={{ margin: "8px 0 0 18px", color: "rgba(15,23,42,.76)" }}>
              <li>divulgação em placas informativas (ex.: com QR Code), conforme diretrizes;</li>
              <li>associação positiva à responsabilidade socioambiental;</li>
              <li>mídia espontânea e conteúdo para redes sociais.</li>
            </ul>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>Reconhecimento social e institucional</h3>
            <ul style={{ margin: "8px 0 0 18px", color: "rgba(15,23,42,.76)" }}>
              <li>valorização pública da iniciativa;</li>
              <li>fortalecimento da reputação e do vínculo com a comunidade.</li>
            </ul>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>Compromisso com o bem comum</h3>
            <ul style={{ margin: "8px 0 0 18px", color: "rgba(15,23,42,.76)" }}>
              <li>melhoria direta da qualidade de vida urbana;</li>
              <li>ambientes mais limpos, seguros, verdes e agradáveis;</li>
              <li>incentivo ao uso coletivo e democrático dos espaços.</li>
            </ul>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>Responsabilidade ambiental e social</h3>
            <ul style={{ margin: "8px 0 0 18px", color: "rgba(15,23,42,.76)" }}>
              <li>preservação e manutenção de áreas verdes;</li>
              <li>contribuição para sustentabilidade urbana e recursos naturais;</li>
              <li>ação concreta de cidadania e responsabilidade social.</li>
            </ul>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>Engajamento comunitário</h3>
            <ul style={{ margin: "8px 0 0 18px", color: "rgba(15,23,42,.76)" }}>
              <li>participação cidadã e senso de pertencimento;</li>
              <li>possibilidade de promover eventos, oficinas e mutirões (quando permitido no termo).</li>
            </ul>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.76)" }}>
            <h3>Incentivo à sustentabilidade urbana</h3>
            <p style={{ marginTop: 6 }}>
              Contribui para uma cidade mais resiliente e sustentável, com espaços públicos mais qualificados.
            </p>
          </div>
        </div>

        <hr className="hr" />

        <h2 style={{ marginTop: 0 }}>Perguntas frequentes</h2>

        <details open>
          <summary>Quem pode adotar?</summary>
          <p>
            Pessoas físicas e jurídicas, associações e entidades da sociedade civil, respeitadas as restrições e impedimentos
            previstos na norma municipal e no termo.
          </p>
        </details>

        <details>
          <summary>A adoção dá direito de uso exclusivo do espaço?</summary>
          <p>
            Não. A adoção não concede uso exclusivo e não equivale a concessão/permissão. O espaço permanece público, com regras
            definidas no termo.
          </p>
        </details>

        <details>
          <summary>O que o protótipo (MVP) guarda sobre anexos?</summary>
          <p>
            Neste MVP, guardamos apenas metadados dos arquivos (nome/tamanho). O upload real será implementado quando entrarmos no backend.
          </p>
        </details>

        <hr className="hr" />

        <p style={{ marginBottom: 0, opacity: 0.85 }}>
          <strong>Base legal (Betim):</strong> Lei Municipal nº 6.180/2017 e Decreto nº 40.891/2017.
        </p>
      </section>
    </div>
  );
}