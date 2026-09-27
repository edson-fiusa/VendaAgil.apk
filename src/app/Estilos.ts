import { StyleSheet } from 'react-native';

export const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#b6eeb6',
    borderRadius: 5,
  },

  keyboardContainer: {
    flex: 1,
  },

  loginContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 80,
  },

  // Em paisagem (celular deitado ou tablet), coloca a logo ao
  // lado do cartão de login em vez de empilhado.
  loginContainerPaisagem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
  },

  logoArea: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logoAreaPaisagem: {
    marginBottom: 0,
    flex: 1,
    maxWidth: 320,
  },

  logoAdmin: {
    width: 300,
    height: 300,
  },

  logoAdminLargo: {
    width: 220,
    height: 220,
  },

  loginCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    elevation: 4,
  },

  // Em tablet/paisagem, o cartão de login fica com largura
  // limitada e centralizado, em vez de esticar a tela toda.
  loginCardLargo: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: 28,
  },

  loginCardPaisagem: {
    flex: 1,
    maxWidth: 420,
    alignSelf: 'center',
  },

  loginTitulo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#518859',
    marginBottom: 20,
  },

  voltarLogin: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 18,
    backgroundColor: '#a4e4ba',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#161d2c',
    fontSize: 14,
  },

  botaoDesabilitado: {
    opacity: 0.5,
  },

  botaoPrincipal: {
    backgroundColor: '#279905',
    borderRadius: 12,
    padding: 17,
    marginBottom: 12,
  },

  botaoPrincipalTexto: {
    color: '#f5f5f5',
    fontSize: 17,
    fontWeight: '800',
  },

  botaoDescricao: {
    color: '#2ff707',
    fontSize: 12,
    marginTop: 5,
  },

  botaoSecundario: {
    backgroundColor: '#279905',
    borderRadius: 12,
    padding: 17,
  },

  botaoSecundarioTexto: {
    color: '#f5f8ff',
    fontSize: 17,
    fontWeight: '800',
  },

  botaoDescricaoEscuro: {
    color: '#2ff707',
    fontSize: 12,
    marginTop: 5,
  },

  botaoEntrar: {
    backgroundColor: '#2563eb',
    borderRadius: 9,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },

  botaoEntrarTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  topoInterno: {
    height: 58,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  voltarInterno: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: '#a4e4ba',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 15,
  },

  topoTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  adminContainer: {
    padding: 18,
    paddingBottom: 40,
  },

  // Em tablet/paisagem, centraliza o conteúdo do painel com
  // largura máxima e permite que os botões de menu fiquem
  // lado a lado (ver menuButtonLargo + secaoMenuTituloLargo).
  adminContainerLargo: {
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  adminCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    width: '100%',
  },

  adminSubtitulo: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },

  botaoSairPequeno: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },

  botaoSairTexto: {
    color: '#b91c1c',
    fontWeight: '800',
    fontSize: 13,
  },

  secaoMenuTitulo: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 9,
  },

  // Título de seção sempre ocupa a linha inteira, mesmo
  // quando os botões do menu estão organizados em 2 colunas.
  secaoMenuTituloLargo: {
    width: '100%',
  },

  menuButton: {
    backgroundColor: '#fff',
    borderRadius: 13,
    padding: 17,
    marginBottom: 11,
    elevation: 2,
    width: '100%',
  },

  // Em tablet/paisagem, os botões do menu ficam em duas
  // colunas (2 por linha) para aproveitar a largura da tela.
  menuButtonLargo: {
    width: '48.5%',
  },

  menuButtonTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
  },

  menuButtonDescription: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },

  // ============================================================
  // TESTE / BLOQUEIO / BOAS-VINDAS
  // ============================================================

  telaCarregamentoTeste: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoCarregamentoTeste: {
    marginTop: 12,
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },

  bloqueioIcone: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 10,
  },

  bloqueioTexto: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 18,
    lineHeight: 19,
  },

  modalFundoBoasVindas: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalBoasVindas: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },

  modalBoasVindasLargo: {
    maxWidth: 460,
  },

  boasVindasIcone: {
    fontSize: 40,
    marginBottom: 8,
  },

  boasVindasTitulo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },

  boasVindasTexto: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
  },

  boasVindasDias: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '900',
    color: '#279905',
    textAlign: 'center',
  },

  boasVindasTextoSecundario: {
    marginTop: 14,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },

  botaoBoasVindas: {
    marginTop: 20,
    backgroundColor: '#279905',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
  },

  botaoBoasVindasTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});


