import React, { useCallback, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  BackupInfo,
  compartilharBackupLocal,
  fazerBackupLocal,
  obterInfoBackupLocal,
  restaurarBackupLocal,
} from '../database/backup';

// ============================================================
// UTILITÁRIOS
// ============================================================

function formatarData(dataIso?: string): string {
  if (!dataIso) {
    return '';
  }

  const data = new Date(dataIso);

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarTamanho(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return '';
  }

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;

  return `${mb.toFixed(2)} MB`;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Backup() {
  const [info, setInfo] = useState<BackupInfo>({ existe: false });

  const [carregandoInfo, setCarregandoInfo] = useState(true);

  const [fazendoBackup, setFazendoBackup] = useState(false);

  const [restaurando, setRestaurando] = useState(false);

  const [enviando, setEnviando] = useState(false);

  const carregarInfo = useCallback(async () => {
    try {
      setCarregandoInfo(true);

      const resultado = await obterInfoBackupLocal();

      setInfo(resultado);
    } catch (erro: any) {
      console.error('Erro ao carregar informações do backup:', erro);
    } finally {
      setCarregandoInfo(false);
    }
  }, []);

  useEffect(() => {
    carregarInfo();
  }, [carregarInfo]);

  async function lidarComBackup() {
    try {
      setFazendoBackup(true);

      const resultado = await fazerBackupLocal();

      setInfo(resultado);

      Alert.alert(
        'Backup concluído',
        'O backup local foi salvo com sucesso no seu aparelho.'
      );
    } catch (erro: any) {
      console.error('Erro ao fazer backup:', erro);

      Alert.alert(
        'Erro ao fazer backup',
        erro?.message || 'Não foi possível concluir o backup agora.'
      );
    } finally {
      setFazendoBackup(false);
    }
  }

  async function lidarComEnvio() {
    if (!info.existe) {
      Alert.alert(
        'Nenhum backup encontrado',
        'Faça um backup antes de enviar.'
      );

      return;
    }

    try {
      setEnviando(true);

      await compartilharBackupLocal();
    } catch (erro: any) {
      console.error('Erro ao enviar backup:', erro);

      Alert.alert(
        'Erro ao enviar',
        erro?.message || 'Não foi possível abrir o compartilhamento agora.'
      );
    } finally {
      setEnviando(false);
    }
  }

  function confirmarRestauracao() {
    if (!info.existe) {
      Alert.alert(
        'Nenhum backup encontrado',
        'Faça um backup antes de tentar restaurar.'
      );

      return;
    }

    Alert.alert(
      'Restaurar backup',
      'Isso vai substituir os dados atuais pelos dados do último backup salvo. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: lidarComRestauracao,
        },
      ]
    );
  }

  async function lidarComRestauracao() {
    try {
      setRestaurando(true);

      await restaurarBackupLocal();

      Alert.alert(
        'Restauração concluída',
        'Os dados foram restaurados a partir do último backup.'
      );

      await carregarInfo();
    } catch (erro: any) {
      console.error('Erro ao restaurar backup:', erro);

      Alert.alert(
        'Erro ao restaurar',
        erro?.message || 'Não foi possível restaurar o backup agora.'
      );
    } finally {
      setRestaurando(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.titulo}>Backup local</Text>

        <Text style={styles.texto}>
          Salva uma cópia dos dados do aplicativo dentro do próprio
          celular. Não depende de internet.
        </Text>

        {carregandoInfo ? (
          <ActivityIndicator
            color="#279905"
            style={styles.espacoTopo}
          />
        ) : info.existe ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoLinha}>
              Último backup: {formatarData(info.data)}
            </Text>

            {!!info.tamanho && (
              <Text style={styles.infoLinha}>
                Tamanho: {formatarTamanho(info.tamanho)}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoLinhaVazia}>
              Nenhum backup foi feito ainda.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.botaoPrincipal,
            fazendoBackup && styles.botaoDesabilitado,
          ]}
          onPress={lidarComBackup}
          disabled={fazendoBackup || restaurando || enviando}
        >
          {fazendoBackup ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoPrincipalTexto}>
              Fazer backup agora
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.titulo}>Enviar backup para fora do aparelho</Text>

        <Text style={styles.texto}>
          Envie o arquivo de backup por e-mail, Google Drive, WhatsApp ou
          qualquer outro app instalado. Recomendado: se o celular quebrar,
          perder ou for roubado, o backup guardado só dentro dele também
          se perde — por isso vale a pena guardar uma cópia fora, de vez
          em quando.
        </Text>

        <TouchableOpacity
          style={[
            styles.botaoTerciario,
            (enviando || !info.existe) && styles.botaoDesabilitado,
          ]}
          onPress={lidarComEnvio}
          disabled={enviando || fazendoBackup || restaurando || !info.existe}
        >
          {enviando ? (
            <ActivityIndicator color="#1d4ed8" />
          ) : (
            <Text style={styles.botaoTerciarioTexto}>
              Enviar backup (e-mail, Drive, etc.)
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.titulo}>Restaurar backup</Text>

        <Text style={styles.texto}>
          Substitui os dados atuais pelos dados salvos no último backup.
          Use com cuidado: o que foi feito depois do backup será perdido.
        </Text>

        <TouchableOpacity
          style={[
            styles.botaoSecundario,
            (restaurando || !info.existe) &&
              styles.botaoDesabilitado,
          ]}
          onPress={confirmarRestauracao}
          disabled={restaurando || fazendoBackup || enviando || !info.existe}
        >
          {restaurando ? (
            <ActivityIndicator color="#b91c1c" />
          ) : (
            <Text style={styles.botaoSecundarioTexto}>
              Restaurar último backup
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 13,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
  },

  titulo: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  texto: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
    marginBottom: 14,
  },

  espacoTopo: {
    marginTop: 6,
    marginBottom: 14,
  },

  infoBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },

  infoLinha: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },

  infoLinhaVazia: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600',
  },

  botaoPrincipal: {
    backgroundColor: '#279905',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },

  botaoPrincipalTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  botaoTerciario: {
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },

  botaoTerciarioTexto: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '800',
  },

  botaoSecundario: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },

  botaoSecundarioTexto: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '800',
  },

  botaoDesabilitado: {
    opacity: 0.5,
  },
});