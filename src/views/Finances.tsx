'use client';

import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useFinance } from '@/context/FinanceContext';
import { useApp } from '@/context/AppContext';
import { FinanceTransaction, FinanceSection, FinancePaymentStatus, FinanceCpfCnpj } from '@/types';
import { Plus, Trash2, X, Wallet, ShieldAlert, Edit2, Clock } from 'lucide-react';
import styles from './Finances.module.css';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${names[parseInt(mo)-1]} ${y}`;
};

const STATUS_LABELS: Record<FinancePaymentStatus, string> = {
  paid:'Pago', auto_debit:'Débito Auto', scheduled:'Agendado', pending:'Pendente', overdue:'Atrasado',
};
const STATUS_CSS: Record<FinancePaymentStatus, string> = {
  paid: styles.statusPaid, auto_debit: styles.statusAuto,
  scheduled: styles.statusScheduled, pending: styles.statusPending, overdue: styles.statusOverdue,
};
const CATEGORIES = [
  'Sobrevivência','Cartão Crédito','Telefonia','Esporte','Energia',
  'Limpeza e Manutenção','Saúde','Contabilidade','Impostos','Lazer',
  'Alimentação','Transporte','Educação','Outro',
];
const CHART_COLORS = ['#3B82F6','#F59E0B','#FF1493','#10B981','#8B5CF6','#EF4444','#06B6D4','#F97316','#84CC16','#EC4899','#14B8A6','#A78BFA'];

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Finances() {
  const { months, transactions, activeMonthId, setActiveMonthId, createMonth, addTransaction, deleteTransaction, updateTransaction } = useFinance();
  const { assets } = useApp();

  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [addSection, setAddSection] = useState<FinanceSection | null>(null);
  const [editTx, setEditTx] = useState<FinanceTransaction | null>(null);

  const sortedMonths = useMemo(() => [...months].sort((a,b) => b.month.localeCompare(a.month)), [months]);
  const activeMonth = useMemo(() => months.find(m => m.id === activeMonthId), [months, activeMonthId]);
  const monthTxs = useMemo(() => transactions.filter(t => t.monthId === activeMonthId), [transactions, activeMonthId]);

  const boletos     = useMemo(() => monthTxs.filter(t => t.section==='boleto').sort((a,b)=>(a.dueDay||0)-(b.dueDay||0)), [monthTxs]);
  const assinaturas = useMemo(() => monthTxs.filter(t => t.section==='assinatura'), [monthTxs]);
  const extras      = useMemo(() => monthTxs.filter(t => t.section==='extra'), [monthTxs]);
  const incomes     = useMemo(() => monthTxs.filter(t => t.section==='income'), [monthTxs]);

  const totalBoletos     = useMemo(() => boletos.reduce((s,t)=>s+t.value,0), [boletos]);
  const totalAssinaturas = useMemo(() => assinaturas.reduce((s,t)=>s+t.value,0), [assinaturas]);
  const totalExtras      = useMemo(() => extras.reduce((s,t)=>s+t.value,0), [extras]);
  const totalIncome      = useMemo(() => incomes.reduce((s,t)=>s+t.value,0), [incomes]);
  // Assinaturas não entram no cálculo de despesas pois já vêm cobradas na fatura do cartão (boleto)
  const totalExp         = totalBoletos + totalExtras;
  const balance          = totalIncome - totalExp;

  const categoryTotals = useMemo(() => {
    const map: Record<string,number> = {};
    // Assinaturas também não entram no gráfico de gastos para evitar duplicidade
    [...boletos,...extras].forEach(t => {
      const cat = t.category || 'Outro';
      map[cat] = (map[cat]||0) + t.value;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value);
  }, [boletos, extras]);

  const totalInvestments = useMemo(() => assets.reduce((s,a)=>s+a.currentValue,0), [assets]);
  const survivalMonths = totalExp > 0 ? totalInvestments / totalExp : 0;
  const survivalYears  = survivalMonths / 12;

  const toggleStatus = (tx: FinanceTransaction) => {
    const cycle: FinancePaymentStatus[] = ['pending','paid','auto_debit','scheduled'];
    const cur = tx.paymentStatus || 'pending';
    const next = cycle[(cycle.indexOf(cur)+1) % cycle.length];
    updateTransaction(tx.id, { paymentStatus: next });
  };

  const handleImportAndCreate = (monthStr: string, importFromId: string | null) => {
    const newMonth = createMonth(monthStr);
    if (importFromId) {
      const toCopy = transactions.filter(t => t.monthId === importFromId && (t.section === 'boleto' || t.section === 'assinatura' || t.section === 'income'));
      toCopy.forEach(t => {
        const { id, createdAt, monthId, ...rest } = t;
        addTransaction({ ...rest, monthId: newMonth.id, paymentStatus: t.section === 'boleto' ? 'pending' : t.paymentStatus });
      });
    }
    setIsMonthModalOpen(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}><Wallet size={22}/> Controle Financeiro</div>
        <div className={styles.headerRight}>
          <select className={styles.monthSelect} value={activeMonthId||''} onChange={e=>setActiveMonthId(e.target.value)}>
            {sortedMonths.length===0 && <option value="">Nenhum mês</option>}
            {sortedMonths.map(m=><option key={m.id} value={m.id}>{fmtMonth(m.month)}</option>)}
          </select>
          {activeMonthId && (
            <button className={styles.btnSecondary} onClick={() => { if(confirm('Tem certeza que deseja excluir este mês e TODOS os seus lançamentos?')) deleteMonth(activeMonthId) }}>
              <Trash2 size={16}/> Excluir Mês
            </button>
          )}
          <button className={styles.btnPrimary} onClick={()=>setIsMonthModalOpen(true)}>
            <Plus size={16}/> Novo Mês
          </button>
        </div>
      </header>

      {!activeMonth ? (
        <div className={styles.emptyState}>
          <Clock size={48}/>
          <h2>Nenhum mês criado ainda</h2>
          <p>Inicie seu controle financeiro criando o primeiro mês.</p>
          <button className={styles.btnPrimary} onClick={()=>setIsMonthModalOpen(true)}><Plus size={18}/> Criar Primeiro Mês</button>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className={styles.summaryRow}>
            <SummaryCard label="Total de Entradas" value={totalIncome} accent="#10B981"/>
            <SummaryCard label="Boletos" value={totalBoletos} accent="#3B82F6"/>
            <SummaryCard label="Assinaturas" value={totalAssinaturas} accent="#F59E0B"/>
            <SummaryCard label="Gastos Extras" value={totalExtras} accent="#FF1493"/>
            <SummaryCard label="Sobra / Falta" value={balance} accent={balance>=0?'#10B981':'#EF4444'} highlight/>
          </div>

          {/* Sobrevivência */}
          <div className={styles.survivalCard}>
            <div className={styles.survivalIcon}><ShieldAlert size={28}/></div>
            <div className={styles.survivalBody}>
              <div className={styles.survivalTitle}>Tempo de Sobrevivência</div>
              <div className={styles.survivalDesc}>
                Com seu patrimônio investido de <strong>{fmt(totalInvestments)}</strong> e custo mensal de <strong>{fmt(totalExp)}</strong>, você sobreviveria por:
              </div>
            </div>
            <div className={styles.survivalNumbers}>
              <div className={styles.survivalMain}>{survivalMonths>0?`${survivalMonths.toFixed(0)} meses`:'–'}</div>
              {survivalYears>0 && <div className={styles.survivalSub}>≈ {survivalYears.toFixed(1)} anos</div>}
            </div>
          </div>

          {/* Duas colunas */}
          <div className={styles.twoCol}>
            <div className={styles.colLeft}>
              <Section title="Controle de Boletos" total={totalBoletos} accent="#3B82F6" onAdd={()=>setAddSection('boleto')}>
                <table className={styles.table}>
                  <thead><tr><th>Descrição</th><th>Vcto</th><th>Categoria</th><th>CPF/CNPJ</th><th>Valor</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {boletos.length===0 && <tr><td colSpan={7} className={styles.emptyRow}>Nenhum boleto.</td></tr>}
                    {boletos.map(tx=>(
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td className={styles.centerCell}>{tx.dueDay?`Dia ${tx.dueDay}`:'–'}</td>
                        <td>{tx.category||'–'}</td>
                        <td>{tx.cpfCnpj&&<span className={tx.cpfCnpj==='CPF'?styles.tagCpf:styles.tagCnpj}>{tx.cpfCnpj}</span>}</td>
                        <td className={styles.valueCell}>{fmt(tx.value)}</td>
                        <td><button className={`${styles.statusBtn} ${STATUS_CSS[tx.paymentStatus||'pending']}`} onClick={()=>toggleStatus(tx)}>{STATUS_LABELS[tx.paymentStatus||'pending']}</button></td>
                        <td className={styles.actionCell}>
                          <button className={styles.editBtn} onClick={()=>setEditTx(tx)} title="Editar"><Edit2 size={13}/></button>
                          <button className={styles.delBtn} onClick={()=>{if(confirm('Apagar?'))deleteTransaction(tx.id)}} title="Apagar"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {boletos.length>0&&<tfoot><tr><td colSpan={4} className={styles.totalLabel}>TOTAL</td><td className={styles.totalValue}>{fmt(totalBoletos)}</td><td colSpan={2}></td></tr></tfoot>}
                </table>
              </Section>

              <Section title="Assinaturas — Débito Automático" total={totalAssinaturas} accent="#F59E0B" onAdd={()=>setAddSection('assinatura')}>
                <table className={styles.table}>
                  <thead><tr><th>Descrição</th><th>Categoria</th><th>Cartão</th><th>Valor</th><th></th></tr></thead>
                  <tbody>
                    {assinaturas.length===0 && <tr><td colSpan={5} className={styles.emptyRow}>Nenhuma assinatura.</td></tr>}
                    {assinaturas.map(tx=>(
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td>{tx.category||'–'}</td>
                        <td><span className={styles.tagCard}>{tx.card||'PF'}</span></td>
                        <td className={styles.valueCell}>{fmt(tx.value)}</td>
                        <td className={styles.actionCell}>
                          <button className={styles.editBtn} onClick={()=>setEditTx(tx)} title="Editar"><Edit2 size={13}/></button>
                          <button className={styles.delBtn} onClick={()=>{if(confirm('Apagar?'))deleteTransaction(tx.id)}} title="Apagar"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {assinaturas.length>0&&<tfoot><tr><td colSpan={3} className={styles.totalLabel}>TOTAL</td><td className={styles.totalValue}>{fmt(totalAssinaturas)}</td><td></td></tr></tfoot>}
                </table>
              </Section>
            </div>

            <div className={styles.colRight}>
              <Section title="Gastos Extras" total={totalExtras} accent="#FF1493" onAdd={()=>setAddSection('extra')}>
                <table className={styles.table}>
                  <thead><tr><th>Descrição</th><th>Valor</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {extras.length===0 && <tr><td colSpan={4} className={styles.emptyRow}>Nenhum gasto extra.</td></tr>}
                    {extras.map(tx=>(
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td className={styles.valueCell}>{fmt(tx.value)}</td>
                        <td><button className={`${styles.statusBtn} ${STATUS_CSS[tx.paymentStatus||'pending']}`} onClick={()=>toggleStatus(tx)}>{STATUS_LABELS[tx.paymentStatus||'pending']}</button></td>
                        <td className={styles.actionCell}>
                          <button className={styles.editBtn} onClick={()=>setEditTx(tx)} title="Editar"><Edit2 size={13}/></button>
                          <button className={styles.delBtn} onClick={()=>{if(confirm('Apagar?'))deleteTransaction(tx.id)}} title="Apagar"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {extras.length>0&&<tfoot><tr><td className={styles.totalLabel}>TOTAL</td><td className={styles.totalValue}>{fmt(totalExtras)}</td><td colSpan={2}></td></tr></tfoot>}
                </table>
              </Section>

              <Section title="Entrada e Saída" total={null} accent="#10B981" onAdd={()=>setAddSection('income')}>
                <table className={styles.table}>
                  <thead><tr><th>Descrição</th><th>Valor</th><th></th></tr></thead>
                  <tbody>
                    {incomes.length===0 && <tr><td colSpan={3} className={styles.emptyRow}>Nenhuma entrada registrada.</td></tr>}
                    {incomes.map(tx=>(
                      <tr key={tx.id}>
                        <td className={styles.descCell}>{tx.description}</td>
                        <td className={`${styles.valueCell} ${styles.incomeValue}`}>{fmt(tx.value)}</td>
                        <td className={styles.actionCell}>
                          <button className={styles.editBtn} onClick={()=>setEditTx(tx)} title="Editar"><Edit2 size={13}/></button>
                          <button className={styles.delBtn} onClick={()=>{if(confirm('Apagar?'))deleteTransaction(tx.id)}} title="Apagar"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td className={styles.totalLabel}>Total de entrada</td><td className={`${styles.totalValue} ${styles.incomeValue}`}>{fmt(totalIncome)}</td><td></td></tr>
                    <tr><td className={styles.totalLabel}>Gastos do mês</td><td className={`${styles.totalValue} ${styles.expenseValue}`}>{fmt(totalExp)}</td><td></td></tr>
                    <tr className={styles.balanceRow}><td className={styles.totalLabel}>Sobra / Falta</td><td className={`${styles.totalValue} ${balance>=0?styles.incomeValue:styles.expenseValue}`}>{fmt(balance)}</td><td></td></tr>
                  </tfoot>
                </table>
              </Section>
            </div>
          </div>

          {/* Gráfico de Gastos */}
          {categoryTotals.length>0 && (
            <div className={styles.chartSection}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Distribuição de Gastos por Categoria</h3>
              </div>
              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={categoryTotals} cx="50%" cy="50%" innerRadius={75} outerRadius={130}
                      paddingAngle={3} dataKey="value"
                      label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
                      labelLine={true}>
                      {categoryTotals.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v:number)=>fmt(v)}/>
                    <Legend formatter={(value)=>value}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.chartLegend}>
                  {categoryTotals.map((c,i)=>(
                    <div key={c.name} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{background:CHART_COLORS[i%CHART_COLORS.length]}}/>
                      <span className={styles.legendName}>{c.name}</span>
                      <span className={styles.legendVal}>{fmt(c.value)}</span>
                      <span className={styles.legendPct}>{totalExp>0?`${((c.value/totalExp)*100).toFixed(1)}%`:''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {isMonthModalOpen && (
        <MonthModal
          months={sortedMonths}
          onClose={()=>setIsMonthModalOpen(false)}
          onCreate={handleImportAndCreate}
        />
      )}
      {addSection && activeMonthId && (
        <TxModal section={addSection} monthId={activeMonthId} onClose={()=>setAddSection(null)}
          onSave={(data)=>{addTransaction(data);setAddSection(null);}}/>
      )}
      {editTx && (
        <TxModal section={editTx.section} monthId={editTx.monthId} existing={editTx}
          onClose={()=>setEditTx(null)}
          onSave={(data)=>{updateTransaction(editTx.id, data as Partial<FinanceTransaction>);setEditTx(null);}}/>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({title,total,accent,onAdd,children}:{title:string;total:number|null;accent:string;onAdd:()=>void;children:React.ReactNode}) {
  return (
    <div className={styles.section} style={{'--s-accent':accent} as React.CSSProperties}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>{title}</div>
        <div className={styles.sectionHeaderRight}>
          {total!==null&&<span className={styles.sectionTotal}>{fmt(total)}</span>}
          <button className={styles.addBtn} onClick={onAdd}><Plus size={15}/></button>
        </div>
      </div>
      <div className={styles.tableWrap}>{children}</div>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({label,value,accent,highlight}:{label:string;value:number;accent:string;highlight?:boolean}) {
  return (
    <div className={styles.summaryCard} style={{'--accent':accent} as React.CSSProperties}>
      <div className={styles.summaryLabel}>{label}</div>
      <div className={styles.summaryValue} style={{color: highlight?(value>=0?'#10B981':'#EF4444'):accent}}>{fmt(value)}</div>
    </div>
  );
}

// ─── Month Modal ──────────────────────────────────────────────────────────────
function MonthModal({months,onClose,onCreate}:{months:{id:string;month:string}[];onClose:()=>void;onCreate:(v:string,importId:string|null)=>void}) {
  const [val,setVal] = useState(()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [importFrom,setImportFrom] = useState<string>('none');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <div className={styles.modalHead}><h3>Novo Mês de Controle</h3><button className={styles.closeBtn} onClick={onClose}><X size={20}/></button></div>
        <form className={styles.modalBody} onSubmit={e=>{e.preventDefault();if(val)onCreate(val,importFrom==='none'?null:importFrom);}}>
          <div className={styles.formGroup}>
            <label>Mês / Ano</label>
            <input type="month" required className={styles.input} value={val} onChange={e=>setVal(e.target.value)}/>
          </div>
          {months.length>0&&(
            <div className={styles.formGroup}>
              <label>Importar lançamentos fixos de</label>
              <select className={styles.input} value={importFrom} onChange={e=>setImportFrom(e.target.value)}>
                <option value="none">Não importar</option>
                {months.map(m=><option key={m.id} value={m.id}>{fmtMonth(m.month)}</option>)}
              </select>
              <span className={styles.inputHint}>Boletos, assinaturas e receitas serão copiados com status "Pendente".</span>
            </div>
          )}
          <button type="submit" className={styles.submitBtn}>Criar Mês</button>
        </form>
      </div>
    </div>
  );
}

// ─── Transaction Modal ────────────────────────────────────────────────────────
const SECTION_LABELS: Record<FinanceSection,string> = {boleto:'Boleto',assinatura:'Assinatura',extra:'Gasto Extra',income:'Receita'};

function TxModal({section,monthId,existing,onClose,onSave}:{
  section: FinanceSection;
  monthId: string;
  existing?: FinanceTransaction;
  onClose: () => void;
  onSave: (data: Omit<FinanceTransaction,'id'|'createdAt'>) => void;
}) {
  const [desc,setDesc]     = useState(existing?.description||'');
  const [value,setValue]   = useState(existing?.value?String(existing.value):'');
  const [category,setCat]  = useState(existing?.category||CATEGORIES[0]);
  const [dueDay,setDueDay] = useState(existing?.dueDay?String(existing.dueDay):'');
  const [cpfCnpj,setCpf]   = useState<FinanceCpfCnpj>(existing?.cpfCnpj||'CPF');
  const [payStatus,setPay] = useState<FinancePaymentStatus>(existing?.paymentStatus||'pending');
  const [card,setCard]     = useState(existing?.card||'PF');
  const defaultDate = existing?.date || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const [date,setDate] = useState(defaultDate);

  const isExpense = section !== 'income';
  const isEdit = !!existing;

  const handleSubmit = (e:React.FormEvent) => {
    e.preventDefault();
    const data = {
      monthId, type: (isExpense?'expense':'income') as 'income'|'expense',
      section, description: desc, value: parseFloat(value)||0, date,
      category: isExpense?category:undefined,
      dueDay: section==='boleto'&&dueDay?parseInt(dueDay):undefined,
      cpfCnpj: section==='boleto'?cpfCnpj:undefined,
      paymentStatus: (section==='boleto'||section==='extra')?payStatus:undefined,
      card: section==='assinatura'?card:undefined,
    };
    onSave(data);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>{isEdit?`Editar ${SECTION_LABELS[section]}`:`+ ${SECTION_LABELS[section]}`}</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Descrição</label>
            <input required type="text" className={styles.input} value={desc}
              placeholder={section==='income'?'Ex: Salário, Dividendos...':'Ex: Aluguel, Netflix...'}
              onChange={e=>setDesc(e.target.value)}/>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Valor (R$)</label>
              <input required type="number" step="0.01" min="0.01" className={styles.input} value={value} placeholder="0,00" onChange={e=>setValue(e.target.value)}/>
            </div>
            <div className={styles.formGroup}>
              <label>Data</label>
              <input required type="date" className={styles.input} value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
          </div>
          {isExpense&&<div className={styles.formGroup}><label>Categoria</label><select className={styles.input} value={category} onChange={e=>setCat(e.target.value)}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>}
          {section==='boleto'&&(
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Dia de Vencimento</label><input type="number" min="1" max="31" className={styles.input} value={dueDay} placeholder="Ex: 5" onChange={e=>setDueDay(e.target.value)}/></div>
              <div className={styles.formGroup}><label>CPF / CNPJ</label><select className={styles.input} value={cpfCnpj} onChange={e=>setCpf(e.target.value as FinanceCpfCnpj)}><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select></div>
            </div>
          )}
          {(section==='boleto'||section==='extra')&&(
            <div className={styles.formGroup}><label>Status de Pagamento</label><select className={styles.input} value={payStatus} onChange={e=>setPay(e.target.value as FinancePaymentStatus)}><option value="pending">Pendente</option><option value="paid">Pago</option><option value="auto_debit">Débito Automático</option><option value="scheduled">Agendado</option><option value="overdue">Atrasado</option></select></div>
          )}
          {section==='assinatura'&&<div className={styles.formGroup}><label>Cartão / Forma</label><input type="text" className={styles.input} value={card} placeholder="Ex: Nubank PF" onChange={e=>setCard(e.target.value)}/></div>}
          <button type="submit" className={styles.submitBtn}>{isEdit?'Salvar Alterações':'Registrar'}</button>
        </form>
      </div>
    </div>
  );
}
