import LegalLayout from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Termos de Uso — InvestMap',
};

export default function TermosPage() {
  return (
    <LegalLayout title="Termos de Uso" updatedAt="julho de 2026">
      <p>
        Ao criar uma conta e utilizar o <strong>InvestMap</strong>, você concorda com
        estes Termos de Uso. Leia com atenção.
      </p>

      <h2>1. O que o InvestMap é</h2>
      <p>
        O InvestMap é uma ferramenta de <strong>organização financeira e educação</strong>.
        Ele ajuda você a registrar sua carteira, acompanhar a alocação em relação a uma
        estratégia definida por você, controlar finanças mensais e estimar impostos
        sobre operações que você mesmo cadastra.
      </p>

      <h2>2. O que o InvestMap NÃO é</h2>
      <p>
        <strong>O InvestMap não é uma recomendação de investimento, consultoria de
        valores mobiliários, análise ou aconselhamento financeiro ou tributário.</strong>
        Nenhuma informação exibida — incluindo sugestões de rebalanceamento, cálculos de
        imposto, projeções de metas ou análises geradas por inteligência artificial —
        deve ser interpretada como orientação para comprar, vender ou manter qualquer ativo.
      </p>
      <ul>
        <li>As decisões de investimento são exclusivamente suas.</li>
        <li>Os cálculos de imposto são estimativas educacionais e podem não cobrir todas as situações (day trade, operações no exterior, regimes especiais). Confira sempre com um contador e com os programas oficiais da Receita Federal.</li>
        <li>Cotações vêm de terceiros e podem ter atraso ou imprecisão.</li>
      </ul>

      <h2>3. Sua responsabilidade</h2>
      <ul>
        <li>Manter a confidencialidade da sua senha.</li>
        <li>Fornecer dados corretos — a qualidade dos cálculos depende do que você cadastra.</li>
        <li>Usar o aplicativo em conformidade com a legislação aplicável.</li>
      </ul>

      <h2>4. Limitação de responsabilidade</h2>
      <p>
        O InvestMap é fornecido &quot;no estado em que se encontra&quot;. Na máxima extensão
        permitida em lei, não nos responsabilizamos por perdas financeiras, decisões de
        investimento, erros de cálculo de tributos, indisponibilidade de serviços de
        terceiros ou quaisquer danos decorrentes do uso da ferramenta.
      </p>

      <h2>5. Conta e exclusão</h2>
      <p>
        Você pode exportar seus dados ou excluir sua conta a qualquer momento pela tela
        de Perfil. A exclusão remove seus dados e seu login de forma definitiva.
      </p>

      <h2>6. Alterações</h2>
      <p>
        Estes Termos podem ser atualizados. Mudanças relevantes serão comunicadas no
        aplicativo. O uso continuado após alterações implica concordância.
      </p>

      <h2>7. Contato</h2>
      <p>
        Dúvidas sobre estes Termos podem ser encaminhadas pelo canal de contato
        informado no lançamento oficial do aplicativo.
      </p>
    </LegalLayout>
  );
}
