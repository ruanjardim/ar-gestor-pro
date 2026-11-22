import Link from 'next/link';
import {
  BarChart3,
  Building2,
  CalendarCheck2,
  Check,
  CircleDollarSign,
  LockKeyhole,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import styles from './landing.module.css';

export default function Home() {
  const year = new Date().getFullYear();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="AR Gestor Pro — página inicial">
          <span className={styles.mark}>AR</span>
          <span><strong>AR GESTOR PRO</strong><small>Gestão empresarial</small></span>
        </Link>
        <nav className={styles.nav} aria-label="Navegação institucional">
          <a href="#plataforma">Plataforma</a>
          <a href="#recursos">Recursos</a>
          <a href="#sobre">Sobre</a>
        </nav>
        <div className={styles.headerActions}>
          <ThemeToggle showLabel={false} />
          <Link className={styles.ghostButton} href="/login">Entrar</Link>
          <Link className={styles.primaryButton} href="/login">Acessar plataforma</Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><Sparkles /> Gestão inteligente para equipes profissionais</span>
          <h1>Controle sua operação com <em>clareza, segurança e confiança.</em></h1>
          <p>Centralize clientes, vencimentos, cobranças, comunicação e financeiro em um ambiente preparado para o trabalho da sua equipe.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/login">Entrar no AR Gestor Pro</Link>
            <a className={styles.secondaryButton} href="#plataforma">Conhecer a plataforma</a>
          </div>
          <div className={styles.trustLine}>
            <span><ShieldCheck /> Acesso por permissões</span>
            <span><LockKeyhole /> Dados isolados por empresa</span>
            <span><Check /> Modos claro e escuro</span>
          </div>
        </div>

        <div className={styles.productStage} id="plataforma" aria-label="Prévia ilustrativa do dashboard">
          <div className={styles.browserBar}><i /><i /><i /><span>Visão geral do gestor</span></div>
          <div className={styles.productShell}>
            <aside><span className={styles.miniMark}>AR</span>{['Visão geral', 'Clientes', 'Vencimentos', 'Financeiro'].map((item, index) => <b className={index === 0 ? styles.activeNav : ''} key={item}>{item}</b>)}</aside>
            <div className={styles.productContent}>
              <div className={styles.productGreeting}><span>Olá! Acompanhe sua operação.</span><i /></div>
              <div className={styles.previewCards}>
                {['Clientes', 'Vencidos', 'Próximos', 'Em dia'].map((item, index) => <div key={item}><span className={styles[`previewTone${index}`]} /><small>{item}</small><strong>—</strong></div>)}
              </div>
              <div className={styles.previewBottom}>
                <div><small>Distribuição por situação</small><div className={styles.chartBars}>{[42, 68, 54, 86, 60, 78, 47].map((height, index) => <i style={{ height: `${height}%` }} key={index} />)}</div></div>
                <div><small>Próximos vencimentos</small>{['Hoje', 'Em 3 dias', 'Em 7 dias'].map(item => <span key={item}><i /><b>{item}</b><em>—</em></span>)}</div>
              </div>
            </div>
          </div>
          <p>Prévia visual. Seus indicadores reais aparecem após o acesso.</p>
        </div>
      </section>

      <section className={styles.valueStrip} aria-label="Benefícios principais">
        <div><UsersRound /><span><strong>Relacionamento organizado</strong><small>Histórico e dados dos clientes no mesmo lugar.</small></span></div>
        <div><CalendarCheck2 /><span><strong>Vencimentos sob controle</strong><small>Prioridades claras para a rotina de cobrança.</small></span></div>
        <div><ShieldCheck /><span><strong>Operação protegida</strong><small>Perfis, permissões e ambientes separados.</small></span></div>
      </section>

      <section className={styles.features} id="recursos">
        <div className={styles.sectionHeading}><span>Uma plataforma, uma visão</span><h2>Tudo o que sua equipe precisa para trabalhar melhor.</h2><p>Menos dispersão, mais contexto e decisões apoiadas pelos dados da sua própria operação.</p></div>
        <div className={styles.featureGrid}>
          {[
            [UsersRound, 'Gestão de clientes', 'Cadastros, categorias, contatos, dispositivos e histórico operacional organizados.'],
            [CalendarCheck2, 'Vencimentos e cobranças', 'Acompanhe atrasos, próximos vencimentos, cortesias, isenções e renovações.'],
            [MessageCircleMore, 'Comunicação integrada', 'Prepare cobranças e mensagens de WhatsApp usando os dados já cadastrados.'],
            [CircleDollarSign, 'Visão financeira', 'Receitas, despesas, investimentos, planejamento e conciliação para usuários autorizados.'],
            [BarChart3, 'Indicadores objetivos', 'Enxergue a distribuição da carteira e aja sobre o que exige atenção.'],
            [Building2, 'Equipe e empresas', 'Papéis individuais, trilha de atividades e isolamento de dados por organização.'],
          ].map(([Icon, title, description]) => <article key={String(title)}><span><Icon /></span><h3>{String(title)}</h3><p>{String(description)}</p></article>)}
        </div>
      </section>

      <section className={styles.about} id="sobre">
        <div><span className={styles.eyebrow}>Feito para a operação real</span><h2>Profissional por fora. Confiável por dentro.</h2><p>O novo AR Gestor Pro preserva as regras, os cadastros e as permissões que sustentam o sistema, com uma experiência visual mais clara, responsiva e institucional.</p></div>
        <ul><li><Check /> Mesmas regras financeiras e de cobrança</li><li><Check /> Autenticação individual mantida</li><li><Check /> Experiência responsiva em computador e celular</li><li><Check /> Tema escolhido fica salvo neste dispositivo</li></ul>
      </section>

      <section className={styles.finalCta}>
        <span>Seu ambiente está pronto.</span><h2>Entre e conduza sua operação com uma visão mais profissional.</h2><Link className={styles.lightButton} href="/login">Acessar o AR Gestor Pro</Link>
      </section>

      <footer className={styles.footer}><span><b>AR GESTOR PRO</b> © {year}</span><span>Gestão empresarial com clareza e segurança.</span><Link href="/login">Área do cliente</Link></footer>
    </main>
  );
}
