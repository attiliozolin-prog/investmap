'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './Profile.module.css';

export default function Profile() {
  const { user, updateUser } = useAuth();
  
  const [name, setName] = useState(user?.user_metadata?.full_name ?? '');
  const [newPassword, setNewPassword] = useState('');
  
  const [nameLoading, setNameLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    </div>
  );
}
