import LegalLayout from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Política de Privacidade — InvestMap',
};

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="julho de 2026">
      <p>
        Esta Política descreve como o <strong>InvestMap</strong> (&quot;aplicativo&quot;) coleta,
        usa, armazena e protege seus dados pessoais, em conformidade com a Lei nº
        13.709/2018 (Lei Geral de Proteção de Dados — LGPD).
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> e-mail e senha (a senha é armazenada de forma criptografada pelo provedor de autenticação).</li>
        <li><strong>Login social (opcional):</strong> se você entrar com o Google, recebemos seu e-mail e nome associados à conta Google.</li>
        <li><strong>Dados financeiros que você cadastra:</strong> carteiras, ativos, valores, transações, metas e registros de impostos. Esses dados são inseridos por você e servem apenas para os cálculos exibidos no app.</li>
      </ul>
      <p>Não coletamos dados de navegação para publicidade nem compartilhamos seus dados com terceiros para marketing.</p>

      <h2>2. Para que usamos seus dados</h2>
      <ul>
        <li>Autenticar seu acesso e manter sua sessão.</li>
        <li>Calcular e exibir a composição da carteira, rebalanceamento, metas e estimativas de imposto.</li>
        <li>Sincronizar seus dados entre dispositivos.</li>
      </ul>
      <p>Base legal (art. 7º da LGPD): execução de contrato (prestação do serviço que você solicitou) e o seu consentimento ao criar a conta.</p>

      <h2>3. Onde seus dados ficam armazenados</h2>
      <p>
        Os dados são armazenados na infraestrutura do <strong>Supabase</strong>
        (banco de dados PostgreSQL) e protegidos por regras de acesso por linha
        (Row Level Security), de modo que cada usuário só acessa os próprios dados.
        Cotações de mercado são obtidas de serviços de terceiros (ex.: Brapi) sem
        envio dos seus dados pessoais.
      </p>

      <h2>4. Cotações e análise por IA</h2>
      <p>
        Ao solicitar a análise da carteira por inteligência artificial, um resumo
        agregado e anônimo da sua carteira (percentuais por classe, nota de saúde) é
        enviado ao provedor do modelo para gerar o texto. Não enviamos seu e-mail,
        nome ou valores absolutos identificáveis para esse fim.
      </p>

      <h2>5. Seus direitos</h2>
      <p>A LGPD garante a você, a qualquer momento:</p>
      <ul>
        <li><strong>Acesso e portabilidade:</strong> exporte todos os seus dados em JSON pela tela de Perfil.</li>
        <li><strong>Eliminação:</strong> exclua sua conta e todos os dados associados pela opção &quot;Excluir Minha Conta&quot; no Perfil — a remoção é imediata e definitiva, incluindo seu registro de login.</li>
        <li><strong>Correção:</strong> edite ou apague qualquer lançamento diretamente no app.</li>
      </ul>

      <h2>6. Retenção</h2>
      <p>
        Mantemos seus dados enquanto sua conta existir. Ao excluir a conta, os dados
        são apagados dos nossos sistemas. Backups operacionais eventualmente
        existentes são rotacionados em prazo limitado.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Adotamos medidas técnicas como criptografia em trânsito (HTTPS), isolamento
        de dados por usuário e proteção das rotas do servidor. Nenhum sistema é
        100% infalível, mas trabalhamos para reduzir riscos.
      </p>

      <h2>8. Contato</h2>
      <p>
        Para exercer seus direitos ou tirar dúvidas sobre privacidade, utilize o
        canal de contato informado no lançamento oficial do aplicativo.
      </p>
    </LegalLayout>
  );
}
