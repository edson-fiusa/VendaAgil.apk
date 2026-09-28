import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { estilos } from './Estilos';
import type { TelaAdmin } from './Tipos';

import Avarias from './avarias';
import CadastroProduto from './cadastro-produto';
import Feedback from '../app/Feedbackapp';
import GerenciarOperadores from './gerenciar-operadores';
import GerenciarProdutos from './gerenciar-produtos';
import IA from './ia';
import Relatorios from './relatorios';
import Backup from '../database/backup';
import LogAtividades from './seguranca/log_atividades';
import TrocarSenha from './seguranca/trocar-senha';

// ============================================================
// ITENS DO MENU (dados usados para montar a grade de cards)
// ============================================================

interface ItemMenu {
  chave: Exclude<TelaAdmin, 'menu'>;
  titulo: string;
  icone: string;
}

const ITENS_MENU: ItemMenu[] = [
  { chave: 'cadastroProduto', titulo: 'Cadastrar produtos', icone: '📦' },
  { chave: 'gerenciarProdutos', titulo: 'Gerenciar produtos', icone: '📁' },
  { chave: 'gerenciarOperadores', titulo: 'Gerenciar operadores', icone: '👥' },
  { chave: 'avarias', titulo: 'Avarias', icone: '⚠️' },
  { chave: 'ia', titulo: 'Perguntar à IA', icone: '🤖' },
  { chave: 'relatorios', titulo: 'Relatório de vendas', icone: '📊' },
  { chave: 'backup', titulo: 'Backup e restauração', icone: '💾' },
  { chave: 'trocarSenha', titulo: 'Trocar senha', icone: '🔑' },
  { chave: 'logAtividades', titulo: 'Log de atividades', icone: '📋' },
  { chave: 'feedback', titulo: 'Enviar feedback', icone: '💬' },
];

interface PainelAdminProps {
  telaAdmin: TelaAdmin;
  setTelaAdmin: (tela: TelaAdmin) => void;
  isLargo: boolean;
  onSair: () => void;
}

export function PainelAdmin({
  telaAdmin,
  setTelaAdmin,
  isLargo,
  onSair,
}: PainelAdminProps) {
  // Quantidade de cards por linha na grade do menu (2 a 4),
  // controlada pelo gesto de pinça.
  const [colunas, setColunas] = useState(isLargo ? 4 : 3);

  // Escala "ao vivo": acompanha o movimento dos dedos em tempo
  // real (não só no final do gesto), pra pinça parecer suave.
  const escalaViva = useSharedValue(1);

  const estiloEscalaViva = useAnimatedStyle(() => ({
    transform: [{ scale: escalaViva.value }],
  }));

  function ajustarColunas(delta: number) {
    setColunas((atual) => Math.min(4, Math.max(2, atual + delta)));
  }

  const gestoPinca = Gesture.Pinch()
    .onUpdate((evento) => {
      // Enquanto os dedos se movem, os cards vão crescendo ou
      // encolhendo suavemente junto com o gesto.
      escalaViva.value = Math.min(1.12, Math.max(0.9, evento.scale));
    })
    .onEnd((evento) => {
      // Afastar os dedos (scale > 1) = quer ver os cards MAIORES,
      // então diminui a quantidade de colunas.
      // Juntar os dedos (scale < 1) = quer ver MAIS cards por
      // linha, então aumenta a quantidade de colunas.
      if (evento.scale > 1.15) {
        runOnJS(ajustarColunas)(-1);
      } else if (evento.scale < 0.85) {
        runOnJS(ajustarColunas)(1);
      }

      // Solta o dedo: volta suavemente pra escala normal (a
      // mudança real de tamanho passa a ser feita pela troca de
      // colunas, animada pelo LinearTransition de cada card).
      escalaViva.value = withTiming(1, { duration: 220 });
    });

  // ----------------------------------------------------------
  // TELAS INTERNAS
  // ----------------------------------------------------------

  if (telaAdmin !== 'menu') {
    const titulos: Record<Exclude<TelaAdmin, 'menu'>, string> = {
      cadastroProduto: 'Cadastrar produto',
      gerenciarProdutos: 'Gerenciar produtos',
      gerenciarOperadores: 'Gerenciar operadores',
      avarias: 'Avarias',
      relatorios: 'Relatório de vendas',
      ia: '🤖 Assistente IA',
      backup: '💾 Backup e Restauração',
      trocarSenha: '🔑 Trocar senha do admin',
      logAtividades: '📋 Log de atividades',
      feedback: '💬 Enviar feedback',
    };

    return (
      <SafeAreaView style={estilos.container}>
        <View style={estilos.topoInterno}>
          <TouchableOpacity onPress={() => setTelaAdmin('menu')}>
            <Text style={estilos.voltarInterno}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={estilos.topoTitulo}>{titulos[telaAdmin]}</Text>
        </View>

        {telaAdmin === 'cadastroProduto' && <CadastroProduto />}
        {telaAdmin === 'gerenciarProdutos' && <GerenciarProdutos />}
        {telaAdmin === 'gerenciarOperadores' && <GerenciarOperadores />}
        {telaAdmin === 'avarias' && <Avarias />}

        {telaAdmin === 'relatorios' && (
          <Relatorios onVoltar={() => setTelaAdmin('menu')} />
        )}

        {telaAdmin === 'ia' && <IA />}
        {telaAdmin === 'backup' && <Backup />}
        {telaAdmin === 'trocarSenha' && <TrocarSenha />}
        {telaAdmin === 'logAtividades' && <LogAtividades />}
        {telaAdmin === 'feedback' && <Feedback />}
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------------
  // MENU ADMINISTRATIVO
  // ----------------------------------------------------------

  return (
    <LinearGradient
      // Verde no topo esmaecendo para branco/cinza embaixo
      colors={['#7BDD6B', '#BDEFAE', '#F4F6F5']}
      locations={[0, 0.35, 0.85]}
      style={estilosGrade.fundo}
    >
      <SafeAreaView style={estilosGrade.areaSegura}>
        <View style={estilosGrade.cabecalho}>
          <View style={estilosGrade.pillTitulo}>
            <Text style={estilosGrade.pillTituloTexto}>
              Painel Administrativo
            </Text>
          </View>

          <TouchableOpacity style={estilos.botaoSairPequeno} onPress={onSair}>
            <Text style={estilos.botaoSairTexto}>Sair</Text>
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={gestoPinca}>
          <ScrollView contentContainerStyle={estilosGrade.scroll}>
            <Animated.View style={[estilosGrade.grade, estiloEscalaViva]}>
              {ITENS_MENU.map((item) => (
                <Animated.View
                  key={item.chave}
                  layout={LinearTransition.duration(220)}
                  style={{ width: `${100 / colunas}%`, padding: 6 }}
                >
                  <TouchableOpacity
                    style={estilosGrade.card}
                    onPress={() => setTelaAdmin(item.chave)}
                    activeOpacity={0.8}
                  >
                    <Text style={estilosGrade.icone}>{item.icone}</Text>
                    <Text style={estilosGrade.tituloCard}>{item.titulo}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </Animated.View>
          </ScrollView>
        </GestureDetector>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ============================================================
// ESTILOS DA GRADE DE CARDS DO MENU ADMINISTRATIVO
// ============================================================

const estilosGrade = StyleSheet.create({
  fundo: {
    flex: 1,
  },

  areaSegura: {
    flex: 1,
  },

  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
  },

  pillTitulo: {
    backgroundColor: '#FBE1E7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },

  pillTituloTexto: {
    color: '#1f2937',
    fontWeight: '700',
    fontSize: 14,
  },

  scroll: {
    paddingHorizontal: 12,
    paddingBottom: 30,
  },

  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  icone: {
    fontSize: 40,
    marginBottom: 10,
  },

  tituloCard: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});