'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import styles from './Profile.module.css';

export default function Profile() {
  const { user, updateUser, deleteAccountData } = useAuth();
  const { strategies, assets, importData } = useApp();
  const importRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(user?.user_metadata?.full_name ?? '');
  const [newPassword, setNewPassword] = useState('');
  
  const [nameLoading, setNameLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETAR') return;
    setDeleteLoading(true);
    const { error } = await deleteAccountData();
    if (error) {
      alert(error);
      setDeleteLoading(false);
    }
    // Se sucesso, o context faz o signOut e o app limpa automaticamente
  };

  const handleExport = () => {
    const data = { strategies, assets, exportedAt: new Date().toISOString(), version: 1 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investmap-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.strategies || !data.assets) {
          alert('Arquivo inválido. Certifique-se de usar um backup exportado pelo InvestMap.');
          return;
        }
        if (confirm(`Importar ${data.strategies.length} carteira(s) e ${data.assets.length} ativo(s)? Os dados existentes serão mantidos.`)) {
          importData(data.strategies, data.assets);
          alert('Dados importados com sucesso!');
        }
      } catch {
        alert('Erro ao ler o arquivo. Verifique se é um JSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameLoading(true);
    setNameMessage(null);
    try {
      const { error } = await updateUser({ data: { full_name: name } });
      if (error) throw new Error(error);
      setNameMessage({ type: 'success', text: 'Nome atualizado com sucesso!' });
    } catch (err: unknown) {
      setNameMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao atualizar nome' });
    } finally {
      setNameLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdLoading(true);
    setPwdMessage(null);
    try {
      if (newPassword.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres');
      const { error } = await updateUser({ password: newPassword });
      if (error) throw new Error(error);
      setPwdMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
      setNewPassword('');
    } catch (err: unknown) {
      setPwdMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao atualizar senha' });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className={styles.profileContainer}>
      <header className={styles.header}>
        <h2 className={styles.title}>Meu Perfil</h2>
        <p className={styles.subtitle}>Gerencie suas informações pessoais e configurações da conta</p>
      </header>

      <div className={styles.card}>
        <div className={styles.formSection}>
          <h3>Informações da Conta</h3>
          <div className={styles.fieldGroup}>
            <label>E-mail (Login)</label>
            <input 
              type="text" 
              className={styles.input} 
              value={user?.email || ''} 
              disabled 
              readOnly 
            />
            <span className={styles.helpText}>Para alterar seu e-mail, entre em contato com o suporte.</span>
          </div>

          <form onSubmit={handleUpdateName}>
            <div className={styles.fieldGroup}>
              <label>Nome Completo</label>
              <input 
                type="text" 
                className={styles.input} 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Como deseja ser chamado?"
                required
              />
            </div>
            
            {nameMessage && (
              <div className={`${styles.message} ${styles[nameMessage.type]}`}>{nameMessage.text}</div>
            )}
            
            <button 
              type="submit" 
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={nameLoading}
            >
              {nameLoading ? 'Salvando...' : 'Salvar Nome'}
            </button>
          </form>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.formSection}>
          <h3>Portabilidade de Dados</h3>
          <p className={styles.helpText} style={{ marginBottom: '1.5rem', display: 'block' }}>
            Baixe seus dados para backup ou importe de um arquivo anterior.
          </p>
          <div className={styles.buttonGroup}>
            <button className={styles.secondaryBtn} onClick={handleExport}>
              <Download size={18} />
              <span>Exportar Backup (JSON)</span>
            </button>
            <button className={styles.secondaryBtn} onClick={() => importRef.current?.click()}>
              <Upload size={18} />
              <span>Importar JSON</span>
            </button>
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.formSection}>
          <h3>Segurança</h3>
          <form onSubmit={handleUpdatePassword}>
            <div className={styles.fieldGroup}>
              <label>Nova Senha</label>
              <input 
                type="password" 
                className={styles.input} 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                required
                minLength={6}
              />
            </div>

            {pwdMessage && (
              <div className={`${styles.message} ${styles[pwdMessage.type]}`}>{pwdMessage.text}</div>
            )}

            <button 
              type="submit" 
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={pwdLoading}
            >
              {pwdLoading ? 'Atualizando...' : 'Alterar Senha'}
            </button>
          </form>
        </div>
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerCard}>
          <h3>Zona de Perigo</h3>
          <p className={styles.helpText}>
            A exclusão da conta removerá permanentemente todos os seus ativos, estratégias e histórico. Esta ação não pode ser desfeita.
          </p>
          <button 
            className={styles.deleteBtn}
            onClick={() => setShowDeleteModal(true)}
          >
            Excluir Minha Conta
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <AlertTriangle color="#EF4444" size={32} />
              <h2 style={{ margin: 0 }}>Você tem certeza?</h2>
            </div>
            <p>
              Ao confirmar, <strong>todos os seus dados do InvestMap serão apagados</strong>. 
              Você perderá acesso às suas carteiras e histórico de ativos imediatamente.
            </p>
            
            <div className={styles.fieldGroup} style={{ marginTop: '1.5rem' }}>
              <label>Digite <strong>DELETAR</strong> para confirmar:</label>
              <input 
                type="text" 
                className={styles.input}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETAR"
              />
            </div>

            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancelar
              </button>
              <button 
                className={styles.deleteBtn}
                disabled={deleteConfirmText !== 'DELETAR' || deleteLoading}
                onClick={handleDeleteAccount}
                style={{ marginTop: 0, flex: 1 }}
              >
                {deleteLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
