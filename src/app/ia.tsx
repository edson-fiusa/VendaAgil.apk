
import React, { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as Speech from 'expo-speech';

import { obterBanco } from '../../src/database/banco';

const GROQ_API_URL =
  'https://api.groq.com/openai/v1/chat/completions';

const GROQ_API_KEY =
  process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

const GROQ_MODEL =
  'openai/gpt-oss-20b';

type Mensagem = {
  id: string;
  papel: 'user' | 'assistant';
  texto: string;
};

function dinheiro(valor: number | null | undefined): string {
  const numero = Number(valor || 0);

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function numeroBR(valor: number | null | undefined): string {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtQuantidade(valor: number | null | undefined): string {
  const numero = Number(valor || 0);

  return numero.toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
  });
}

/**
 * Converte valores como:
 *
 * R$ 5,95
 *
 * em:
 *
 * 5 reais e 95 centavos
 */
function dinheiroParaVoz(valor: string): string {
  const normalizado = valor
    .replace(/\s/g, '')
    .replace('R$', '')
    .trim();

  const partes = normalizado.split(',');

  let reaisTexto = partes[0] || '0';
  const centavosTexto = partes[1] || '00';

  reaisTexto = reaisTexto.replace(/\./g, '');

  const reais = parseInt(reaisTexto, 10) || 0;
  const centavos = parseInt(centavosTexto, 10) || 0;

  let resultado = '';

  if (reais === 0) {
    resultado = 'zero reais';
  } else if (reais === 1) {
    resultado = '1 real';
  } else {
    resultado = `${reais} reais`;
  }

  if (centavos > 0) {
    if (centavos === 1) {
      resultado += ' e 1 centavo';
    } else {
      resultado += ` e ${centavos} centavos`;
    }
  }

  return resultado;
}

/**
 * Deixa a resposta da IA adequada para leitura em voz alta.
 *
 * Remove:
 * - Markdown
 * - tabelas
 * - barras
 * - asteriscos
 * - separadores
 * - códigos de formatação
 *
 * E transforma valores monetários em linguagem natural.
 */
function prepararTextoParaVoz(texto: string): string {
  let textoVoz = texto || '';

  // Remove blocos de código
  textoVoz = textoVoz.replace(/```[\s\S]*?```/g, '');

  // Remove links Markdown, mantendo o texto
  textoVoz = textoVoz.replace(
    /\[([^\]]+)\]\([^)]+\)/g,
    '$1'
  );

  // Remove negrito
  textoVoz = textoVoz.replace(/\*\*(.*?)\*\*/g, '$1');

  // Remove itálico
  textoVoz = textoVoz.replace(/\*(.*?)\*/g, '$1');

  // Remove underline Markdown
  textoVoz = textoVoz.replace(/__(.*?)__/g, '$1');
  textoVoz = textoVoz.replace(/_(.*?)_/g, '$1');

  // Remove títulos Markdown
  textoVoz = textoVoz.replace(/^#{1,6}\s*/gm, '');

  // Remove linhas de separação
  textoVoz = textoVoz.replace(
    /^\s*[-_=]{3,}\s*$/gm,
    ''
  );

  // Remove linhas de tabela compostas somente por hífens
  textoVoz = textoVoz.replace(
    /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/gm,
    ''
  );

  // Remove barras verticais das tabelas
  textoVoz = textoVoz.replace(/\|/g, ' ');

  // Remove marcadores de lista
  textoVoz = textoVoz.replace(/^\s*[-•]\s+/gm, '');

  // Remove caracteres de formatação que podem ser pronunciados
  textoVoz = textoVoz.replace(/[{}[\]<>]/g, ' ');

  // Converte valores monetários brasileiros
  textoVoz = textoVoz.replace(
    /R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g,
    (valor) => dinheiroParaVoz(valor)
  );

  // Converte valores simples sem separador de milhar
  textoVoz = textoVoz.replace(
    /R\$\s*\d+,\d{2}/g,
    (valor) => dinheiroParaVoz(valor)
  );

  // Remove URLs
  textoVoz = textoVoz.replace(
    /https?:\/\/\S+/gi,
    ''
  );

  // Remove múltiplos espaços
  textoVoz = textoVoz.replace(/\s+/g, ' ');

  // Corrige pontuação com espaços
  textoVoz = textoVoz.replace(/\s+([,.!?;:])/g, '$1');

  // Evita repetição exagerada de pontuação
  textoVoz = textoVoz.replace(/\.{2,}/g, '.');
  textoVoz = textoVoz.replace(/!{2,}/g, '!');
  textoVoz = textoVoz.replace(/\?{2,}/g, '?');

  return textoVoz.trim();
}

/**
 * Gera uma descrição resumida do banco local
 * de acordo com a pergunta do usuário.
 */
async function obterContextoBanco(
  pergunta: string
): Promise<string> {
  const db = await obterBanco();

  const perguntaLower = pergunta.toLowerCase();

  const blocos: string[] = [];

  const querVendas =
    perguntaLower.includes('venda') ||
    perguntaLower.includes('vendas') ||
    perguntaLower.includes('faturamento') ||
    perguntaLower.includes('faturou') ||
    perguntaLower.includes('vendeu') ||
    perguntaLower.includes('vendas de hoje') ||
    perguntaLower.includes('vendas hoje');

  const querEstoque =
    perguntaLower.includes('estoque') ||
    perguntaLower.includes('produto') ||
    perguntaLower.includes('produtos') ||
    perguntaLower.includes('mercadoria') ||
    perguntaLower.includes('quantidade');

  const querBaixoEstoque =
    perguntaLower.includes('baixo estoque') ||
    perguntaLower.includes('estoque baixo') ||
    perguntaLower.includes('acabando') ||
    perguntaLower.includes('pouco estoque') ||
    perguntaLower.includes('repor');

  const querMaisVendidos =
    perguntaLower.includes('mais vendido') ||
    perguntaLower.includes('mais vendidos') ||
    perguntaLower.includes('vende mais') ||
    perguntaLower.includes('vendido');

  const querItens =
    perguntaLower.includes('item') ||
    perguntaLower.includes('itens') ||
    perguntaLower.includes('produto vendido');

  /*
   * ---------------------------------------------------------
   * VENDAS DE HOJE
   * ---------------------------------------------------------
   */
  if (querVendas) {
    try {
      const inicioHoje = new Date();
      inicioHoje.setHours(0, 0, 0, 0);

      const fimHoje = new Date();
      fimHoje.setHours(23, 59, 59, 999);

      const inicioISO = inicioHoje.toISOString();
      const fimISO = fimHoje.toISOString();

      const resumo = await db.getFirstAsync<any>(
        `
        SELECT
          COUNT(*) AS quantidade_vendas,
          COALESCE(SUM(total), 0) AS total_vendas,
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(forma_pagamento) = 'dinheiro'
                THEN total
                ELSE 0
              END
            ),
            0
          ) AS total_dinheiro,
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(forma_pagamento) = 'pix'
                THEN total
                ELSE 0
              END
            ),
            0
          ) AS total_pix
        FROM vendas_local
        WHERE status = 'finalizada'
          AND criado_em >= ?
          AND criado_em <= ?
        `,
        inicioISO,
        fimISO
      );

      if (resumo) {
        blocos.push(`
RESUMO DAS VENDAS DE HOJE:
Quantidade de vendas: ${resumo.quantidade_vendas || 0}
Total vendido: ${dinheiro(resumo.total_vendas)}
Total em dinheiro: ${dinheiro(resumo.total_dinheiro)}
Total em Pix: ${dinheiro(resumo.total_pix)}
        `);
      }
    } catch (erro) {
      console.log(
        'Erro ao consultar resumo de vendas:',
        erro
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * ÚLTIMAS VENDAS
   * ---------------------------------------------------------
   */
  if (querVendas) {
    try {
      const vendas = await db.getAllAsync<any>(
        `
        SELECT
          id,
          operador_id,
          total,
          forma_pagamento,
          valor_recebido,
          troco,
          criado_em,
          status
        FROM vendas_local
        WHERE status = 'finalizada'
        ORDER BY criado_em DESC
        LIMIT 10
        `
      );

      if (vendas.length > 0) {
        let texto = `
ÚLTIMAS VENDAS REGISTRADAS:
`;

        vendas.forEach((venda: any, index: number) => {
          texto += `
Venda ${venda.id}
Horário: ${venda.criado_em || 'não informado'}
Operador ID: ${venda.operador_id || 'não informado'}
Total: ${dinheiro(venda.total)}
Forma de pagamento: ${venda.forma_pagamento || 'não informado'}
`;

          if (
            venda.valor_recebido !== null &&
            venda.valor_recebido !== undefined
          ) {
            texto += `Valor recebido: ${dinheiro(
              venda.valor_recebido
            )}
`;
          }

          if (
            venda.troco !== null &&
            venda.troco !== undefined
          ) {
            texto += `Troco: ${dinheiro(venda.troco)}
`;
          }

          if (index < vendas.length - 1) {
            texto += '\n';
          }
        });

        blocos.push(texto);
      }
    } catch (erro) {
      console.log(
        'Erro ao consultar últimas vendas:',
        erro
      );
    }
  }


  if (querEstoque) {
    try {
      const produtos = await db.getAllAsync<any>(
        `
        SELECT
          id,
          codigo,
          ean,
          nome,
          marca,
          categoria,
          unidade,
          preco_venda,
          quantidade,
          ativo
        FROM produtos_local
        WHERE ativo = 1
        ORDER BY nome COLLATE NOCASE ASC
        LIMIT 300
        `
      );

      if (produtos.length > 0) {
        let texto = `
PRODUTOS E ESTOQUE LOCAL:
Quantidade de produtos cadastrados: ${produtos.length}

`;

        produtos.forEach((produto: any) => {
          texto +=
            `Produto: ${produto.nome || 'Sem nome'} | ` +
            `Código: ${produto.codigo || 'não informado'} | ` +
            `EAN: ${produto.ean || 'não informado'} | ` +
            `Marca: ${produto.marca || 'não informada'} | ` +
            `Categoria: ${produto.categoria || 'não informada'} | ` +
            `Unidade: ${produto.unidade || 'unidade'} | ` +
            `Preço de venda: ${dinheiro(produto.preco_venda)} | ` +
            `Quantidade em estoque: ${fmtQuantidade(produto.quantidade)}\n`;
        });

        blocos.push(texto);
      }
    } catch (erro) {
      console.log(
        'Erro ao consultar produtos:',
        erro
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * BAIXO ESTOQUE
   * ---------------------------------------------------------
   */
  if (querBaixoEstoque) {
    try {
      const produtosBaixoEstoque =
        await db.getAllAsync<any>(
          `
          SELECT
            id,
            codigo,
            ean,
            nome,
            marca,
            quantidade,
            estoque_minimo,
            preco_venda
          FROM produtos_local
          WHERE ativo = 1
            AND quantidade <= estoque_minimo
          ORDER BY quantidade ASC, nome COLLATE NOCASE ASC
          LIMIT 100
          `
        );

      if (produtosBaixoEstoque.length > 0) {
        let texto = `
PRODUTOS COM ESTOQUE BAIXO:
Quantidade de produtos para reposição: ${produtosBaixoEstoque.length}

`;

        produtosBaixoEstoque.forEach((produto: any) => {
          texto +=
            `Produto: ${produto.nome || 'Sem nome'} | ` +
            `Código: ${produto.codigo || 'não informado'} | ` +
            `Quantidade atual: ${fmtQuantidade(produto.quantidade)} | ` +
            `Estoque mínimo: ${fmtQuantidade(produto.estoque_minimo)} | ` +
            `Preço: ${dinheiro(produto.preco_venda)}\n`;
        });

        blocos.push(texto);
      } else {
        blocos.push(`
PRODUTOS COM ESTOQUE BAIXO:
Não existem produtos abaixo ou iguais ao estoque mínimo cadastrado.
`);
      }
    } catch (erro) {
      console.log(
        'Erro ao consultar estoque baixo:',
        erro
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * MAIS VENDIDOS
   * ---------------------------------------------------------
   */
  if (querMaisVendidos) {
    try {
      const maisVendidos =
        await db.getAllAsync<any>(
          `
          SELECT
            i.produto_id,
            i.nome,
            SUM(i.quantidade) AS quantidade_vendida,
            SUM(i.subtotal) AS total_vendido
          FROM itens_venda_local i
          INNER JOIN vendas_local v
            ON v.id = i.venda_id
          WHERE v.status = 'finalizada'
          GROUP BY i.produto_id, i.nome
          ORDER BY quantidade_vendida DESC
          LIMIT 20
          `
        );

      if (maisVendidos.length > 0) {
        let texto = `
PRODUTOS MAIS VENDIDOS:
`;

        maisVendidos.forEach(
          (produto: any, index: number) => {
            texto +=
              `${index + 1}º lugar: ${produto.nome || 'Sem nome'} | ` +
              `Quantidade vendida: ${fmtQuantidade(produto.quantidade_vendida)} | ` +
              `Total vendido: ${dinheiro(produto.total_vendido)}\n`;
          }
        );

        blocos.push(texto);
      }
    } catch (erro) {
      console.log(
        'Erro ao consultar produtos mais vendidos:',
        erro
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * ITENS VENDIDOS
   * ---------------------------------------------------------
   */
  if (querItens) {
    try {
      const itens =
        await db.getAllAsync<any>(
          `
          SELECT
            i.nome,
            SUM(i.quantidade) AS quantidade,
            SUM(i.subtotal) AS subtotal
          FROM itens_venda_local i
          INNER JOIN vendas_local v
            ON v.id = i.venda_id
          WHERE v.status = 'finalizada'
          GROUP BY i.nome
          ORDER BY quantidade DESC
          LIMIT 50
          `
        );

      if (itens.length > 0) {
        let texto = `
RESUMO DOS ITENS VENDIDOS:
`;

        itens.forEach((item: any) => {
          texto +=
            `${item.nome || 'Sem nome'} | ` +
            `Quantidade: ${fmtQuantidade(item.quantidade)} | ` +
            `Total: ${dinheiro(item.subtotal)}\n`;
        });

        blocos.push(texto);
      }
    } catch (erro) {
      console.log(
        'Erro ao consultar itens vendidos:',
        erro
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * CONTEXTO GERAL
   * ---------------------------------------------------------
   *
   * Se a pergunta não se encaixar claramente em uma categoria,
   * fornecemos um resumo pequeno do banco para a IA.
   */
  if (blocos.length === 0) {
    try {
      const quantidadeProdutos =
        await db.getFirstAsync<any>(
          `
          SELECT COUNT(*) AS total
          FROM produtos_local
          WHERE ativo = 1
          `
        );

      const quantidadeVendas =
        await db.getFirstAsync<any>(
          `
          SELECT COUNT(*) AS total
          FROM vendas_local
          WHERE status = 'finalizada'
          `
        );

      const totalVendas =
        await db.getFirstAsync<any>(
          `
          SELECT COALESCE(SUM(total), 0) AS total
          FROM vendas_local
          WHERE status = 'finalizada'
          `
        );

      blocos.push(`
RESUMO GERAL DO BANCO LOCAL:
Produtos ativos cadastrados: ${quantidadeProdutos?.total || 0}
Vendas finalizadas: ${quantidadeVendas?.total || 0}
Total acumulado das vendas: ${dinheiro(totalVendas?.total)}
`);
    } catch (erro) {
      console.log(
        'Erro ao consultar resumo geral:',
        erro
      );
    }
  }

  return blocos.join('\n\n');
}

export default function IA() {
  const [mensagem, setMensagem] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: 'inicio',
      papel: 'assistant',
      texto:
        'Olá! Sou a assistente do Venda Ágil PDV. Posso consultar seu estoque, vendas e produtos cadastrados no banco local. Pode perguntar, por exemplo: quanto vendi hoje, quais produtos estão acabando ou qual produto vendeu mais.',
    },
  ]);

  const [carregando, setCarregando] = useState(false);
  const [falando, setFalando] = useState(false);
  const [tecladoAberto, setTecladoAberto] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  /*
   * ---------------------------------------------------------
   * TECLADO
   * ---------------------------------------------------------
   */
  useEffect(() => {
    const mostrar = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setTecladoAberto(true);

        setTimeout(() => {
          scrollRef.current?.scrollToEnd({
            animated: true,
          });
        }, 150);
      }
    );

    const esconder = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setTecladoAberto(false);
      }
    );

    return () => {
      mostrar.remove();
      esconder.remove();
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * SCROLL AUTOMÁTICO
   * ---------------------------------------------------------
   */
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 100);
  }, [mensagens, carregando]);

  /*
   * ---------------------------------------------------------
   * LEITURA DA RESPOSTA
   * ---------------------------------------------------------
   */
  async function falarTexto(texto: string) {
    try {
      Speech.stop();

      const textoNatural =
        prepararTextoParaVoz(texto);

      if (!textoNatural) {
        return;
      }

      setFalando(true);

      Speech.speak(textoNatural, {
        language: 'pt-BR',
        rate: 0.92,
        pitch: 1.0,

        onDone: () => {
          setFalando(false);
        },

        onStopped: () => {
          setFalando(false);
        },

        onError: () => {
          setFalando(false);
        },
      });
    } catch (erro) {
      console.log(
        'Erro ao falar resposta:',
        erro
      );

      setFalando(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * PARAR VOZ
   * ---------------------------------------------------------
   */
  function pararFala() {
    Speech.stop();
    setFalando(false);
  }

  /*
   * ---------------------------------------------------------
   * ENVIAR PERGUNTA
   * ---------------------------------------------------------
   */
  async function enviarMensagem() {
    const pergunta = mensagem.trim();

    if (!pergunta || carregando) {
      return;
    }

    if (!GROQ_API_KEY) {
      Alert.alert(
        'Chave da IA',
        'A chave EXPO_PUBLIC_GROQ_API_KEY não foi encontrada no arquivo .env.'
      );

      return;
    }

    Keyboard.dismiss();

    const mensagemUsuario: Mensagem = {
      id: `${Date.now()}-user`,
      papel: 'user',
      texto: pergunta,
    };

    setMensagens((anterior) => [
      ...anterior,
      mensagemUsuario,
    ]);

    setMensagem('');
    setCarregando(true);

    try {
      /*
       * Busca primeiro os dados reais no SQLite.
       */
      const contextoBanco =
        await obterContextoBanco(pergunta);

      /*
       * Mantém somente as últimas mensagens
       * para não deixar o prompt gigante.
       */
      const historico = mensagens
        .slice(-10)
        .map((item) => ({
          role:
            item.papel === 'user'
              ? 'user'
              : 'assistant',
          content: item.texto,
        }));

      const systemPrompt = `
Você é a assistente inteligente do sistema Venda Ágil PDV.

Você está atendendo o dono de um pequeno comércio.

Sua função é ajudar a consultar e interpretar:
- vendas;
- faturamento;
- estoque;
- produtos;
- produtos com estoque baixo;
- produtos mais vendidos;
- formas de pagamento;
- informações existentes no banco de dados local.

IMPORTANTE:
Os dados fornecidos abaixo vieram diretamente do banco SQLite local do aplicativo.

Nunca invente números.

Nunca invente produtos.

Nunca invente vendas.

Nunca invente valores.

Se a informação não estiver disponível no banco, diga claramente que não encontrou essa informação.

Fale de maneira humana, simples e natural, como um funcionário experiente explicando os números para o dono da loja.

NÃO fale sobre SQL.

NÃO fale sobre banco de dados, tabelas ou consultas técnicas, a menos que o usuário pergunte especificamente sobre isso.

Quando estiver respondendo sobre vendas, estoque ou produtos, seja objetivo.

Quando houver muitos registros, faça um resumo e destaque o que realmente importa.

IMPORTANTE SOBRE A RESPOSTA:
A resposta também será lida em voz alta.

Portanto, NÃO utilize:
- tabelas Markdown;
- barras verticais;
- asteriscos desnecessários;
- blocos de código;
- símbolos de formatação;
- separadores;
- emojis em excesso.

Não escreva coisas que poderiam ser faladas como "barra", "asterisco", "pipe", "underline" ou qualquer nome de símbolo.

Prefira frases naturais.

Exemplo ruim:

**Hoje tivemos 2 vendas:**

| Venda | Horário | Total |
| 8 | 15:43 | R$ 5,95 |

Exemplo bom:

Hoje tivemos duas vendas. A venda número oito aconteceu às quinze horas e quarenta e três minutos e totalizou cinco reais e noventa e cinco centavos.

Outro exemplo:

Hoje foram realizadas cinco vendas, totalizando cento e vinte reais e cinquenta centavos. Deste valor, oitenta reais foram recebidos em dinheiro e quarenta reais e cinquenta centavos foram recebidos por Pix.

Para listas, use frases naturais.

Em vez de:

1. Refrigerante
2. Arroz
3. Feijão

Prefira:

Os produtos são refrigerante, arroz e feijão.

Se precisar destacar vários produtos, pode dizer:

Os três produtos mais vendidos foram refrigerante, arroz e feijão.

DADOS DO BANCO LOCAL:

${contextoBanco}
`;

      const resposta = await fetch(
        GROQ_API_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },

          body: JSON.stringify({
            model: GROQ_MODEL,

            temperature: 0.2,

            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },

              ...historico,

              {
                role: 'user',
                content: pergunta,
              },
            ],
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        console.log(
          'Erro Groq:',
          dados
        );

        throw new Error(
          dados?.error?.message ||
            'Erro ao consultar a inteligência artificial.'
        );
      }

      const respostaIA =
        dados?.choices?.[0]?.message?.content?.trim();

      if (!respostaIA) {
        throw new Error(
          'A inteligência artificial não retornou uma resposta.'
        );
      }

      const mensagemAssistente: Mensagem = {
        id: `${Date.now()}-assistant`,
        papel: 'assistant',
        texto: respostaIA,
      };

      setMensagens((anterior) => [
        ...anterior,
        mensagemAssistente,
      ]);

      /*
       * Pequeno atraso para a mensagem aparecer
       * antes de iniciar a fala.
       */
      setTimeout(() => {
        falarTexto(respostaIA);
      }, 250);
    } catch (erro: any) {
      console.log(
        'Erro ao enviar mensagem:',
        erro
      );

      const mensagemErro: Mensagem = {
        id: `${Date.now()}-erro`,
        papel: 'assistant',
        texto:
          erro?.message ||
          'Não consegui consultar a inteligência artificial agora.',
      };

      setMensagens((anterior) => [
        ...anterior,
        mensagemErro,
      ]);
    } finally {
      setCarregando(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * MICROFONE
   * ---------------------------------------------------------
   */
  function abrirMicrofone() {
    Alert.alert(
      'Comando de voz',
      'O reconhecimento de voz precisa de um Development Build do Expo para funcionar nativamente.'
    );
  }

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
      keyboardVerticalOffset={
        Platform.OS === 'ios'
          ? 90
          : 0
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTexto}>
          <Text style={styles.titulo}>
            Assistente IA
          </Text>

          <Text style={styles.subtitulo}>
            Venda Ágil PDV
          </Text>
        </View>

        {falando && (
          <TouchableOpacity
            style={styles.botaoParar}
            onPress={pararFala}
          >
            <Text style={styles.botaoPararTexto}>
              Parar
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.lista}
        contentContainerStyle={
          styles.listaConteudo
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          Platform.OS === 'ios'
            ? 'interactive'
            : 'on-drag'
        }
        automaticallyAdjustKeyboardInsets={
          Platform.OS === 'ios'
        }
        onContentSizeChange={() => {
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({
              animated: true,
            });
          }, 50);
        }}
      >
        {mensagens.map((item) => {
          const usuario =
            item.papel === 'user';

          return (
            <View
              key={item.id}
              style={[
                styles.mensagem,
                usuario
                  ? styles.mensagemUsuario
                  : styles.mensagemAssistente,
              ]}
            >
              {!usuario && (
                <Text style={styles.nomeAssistente}>
                  Assistente
                </Text>
              )}

              <Text
                style={[
                  styles.textoMensagem,
                  usuario
                    ? styles.textoUsuario
                    : styles.textoAssistente,
                ]}
              >
                {item.texto}
              </Text>

              {!usuario && (
                <TouchableOpacity
                  style={styles.botaoOuvir}
                  onPress={() =>
                    falando
                      ? pararFala()
                      : falarTexto(item.texto)
                  }
                >
                  <Text style={styles.botaoOuvirTexto}>
                    {falando
                      ? '🔇 Parar'
                      : '🔊 Ouvir'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {carregando && (
          <View
            style={[
              styles.mensagem,
              styles.mensagemAssistente,
              styles.carregando,
            ]}
          >
            <ActivityIndicator size="small" />

            <Text style={styles.textoCarregando}>
              Consultando seus dados...
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.areaEntrada,
          tecladoAberto &&
            styles.areaEntradaTeclado,
        ]}
      >
        <TouchableOpacity
          style={styles.botaoMicrofone}
          onPress={abrirMicrofone}
        >
          <Text style={styles.iconeMicrofone}>
            🎤
          </Text>
        </TouchableOpacity>

        <TextInput
          value={mensagem}
          onChangeText={setMensagem}
          placeholder="Pergunte sobre vendas, estoque..."
          placeholderTextColor="#888"
          multiline
          textAlignVertical="center"
          style={styles.input}
          editable={!carregando}
          onFocus={() => {
            setTimeout(() => {
              scrollRef.current?.scrollToEnd({
                animated: true,
              });
            }, 250);
          }}
          onSubmitEditing={() => {
            if (
              Platform.OS === 'ios'
            ) {
              enviarMensagem();
            }
          }}
        />

        <TouchableOpacity
          style={[
            styles.botaoEnviar,
            (!mensagem.trim() ||
              carregando) &&
              styles.botaoEnviarDesabilitado,
          ]}
          onPress={enviarMensagem}
          disabled={
            !mensagem.trim() ||
            carregando
          }
        >
          {carregando ? (
            <ActivityIndicator
              size="small"
              color="#fff"
            />
          ) : (
            <Text style={styles.iconeEnviar}>
              ➤
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },

  header: {
    minHeight: 70,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#1976d2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTexto: {
    flex: 1,
  },

  titulo: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },

  subtitulo: {
    color: '#dcecff',
    fontSize: 13,
    marginTop: 2,
  },

  botaoParar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
  },

  botaoPararTexto: {
    color: '#1976d2',
    fontWeight: '700',
  },

  lista: {
    flex: 1,
  },

  listaConteudo: {
    padding: 14,
    paddingBottom: 20,
  },

  mensagem: {
    maxWidth: '92%',
    borderRadius: 16,
    padding: 13,
    marginBottom: 12,
  },

  mensagemUsuario: {
    alignSelf: 'flex-end',
    backgroundColor: '#1976d2',
    borderBottomRightRadius: 4,
  },

  mensagemAssistente: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: {
      width: 0,
      height: 1,
  },
  },

  nomeAssistente: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 5,
  },

  textoMensagem: {
    fontSize: 16,
    lineHeight: 23,
  },

  textoUsuario: {
    color: '#fff',
  },

  textoAssistente: {
    color: '#222',
  },

  botaoOuvir: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#eef5ff',
  },

  botaoOuvirTexto: {
    color: '#1976d2',
    fontSize: 13,
    fontWeight: '600',
  },

  carregando: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  textoCarregando: {
    marginLeft: 9,
    color: '#666',
    fontSize: 14,
  },

  areaEntrada: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom:
      Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },

  areaEntradaTeclado: {
    paddingBottom: 8,
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#d0d5da',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#f8f9fa',
    color: '#222',
    fontSize: 16,
    marginHorizontal: 8,
  },

  botaoMicrofone: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef5ff',
  },

  iconeMicrofone: {
    fontSize: 21,
  },

  botaoEnviar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
  },

  botaoEnviarDesabilitado: {
    opacity: 0.45,
  },

  iconeEnviar: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '700',
  },
});
