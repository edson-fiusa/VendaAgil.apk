import { obterBanco } from '../database/banco';

export type ProdutoLocal = {
  id?: number;
  codigo?: string;
  ean?: string;
  nome: string;
  marca?: string;
  descricao?: string;
  imagem?: string;
  ncm?: string;
  precoEntrada?: number;
  precoVenda?: number;
  unidade?: string;
  quantidade?: number;
  estoqueMinimo?: number;
  categoria?: string;
  ativo?: number;
};

export async function listarProdutosLocais() {
  const db = await obterBanco();

  return await db.getAllAsync<ProdutoLocal>(`
    SELECT *
    FROM produtos
    WHERE ativo = 1
    ORDER BY nome ASC
  `);
}

export async function buscarProdutosLocais(busca: string) {
  const db = await obterBanco();

  const termo = `%${busca}%`;

  return await db. getAllAsync<ProdutoLocal>(
    `
      SELECT *
      FROM produtos
      WHERE ativo = 1
      AND (
        nome LIKE ?
        OR codigo LIKE ?
        OR ean LIKE ?
        OR marca LIKE ?
        OR categoria LIKE ?
      )
      ORDER BY nome ASC
    `,
    termo,
    termo,
    termo,
    termo,
    termo
  );
}

export async function cadastrarProdutoLocal(produto: ProdutoLocal) {
  const db = await obterBanco();

  const resultado = await db.runAsync(
    `
      INSERT INTO produtos (
        codigo,
        ean,
        nome,
        marca,
        descricao,
        imagem,
        ncm,
        precoEntrada,
        precoVenda,
        unidade,
        quantidade,
        estoqueMinimo,
        categoria
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    produto.codigo ?? null,
    produto.ean ?? null,
    produto.nome,
    produto.marca ?? null,
    produto.descricao ?? null,
    produto.imagem ?? null,
    produto.ncm ?? null,
    produto.precoEntrada ?? 0,
    produto.precoVenda ?? 0,
    produto.unidade ?? 'UN',
    produto.quantidade ?? 0,
    produto.estoqueMinimo ?? 0,
    produto.categoria ?? null
  );

  return resultado.lastInsertRowId;
}