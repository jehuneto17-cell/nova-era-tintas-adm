export type PedidoEstado =
  | "em_negociacao"
  | "aguardando_pagamento"
  | "aguardando_confirmacao"
  | "pago"
  | "separacao"
  | "enviado"
  | "entregue"
  | "cancelado"
  | "expirado";

export interface PedidoItem {
  produtoId: string;
  nome: string;
  variacao: string;
  qtd: number;
  preco: number;
}

export interface PedidoHistoricoEntrada {
  tipo?: "estado" | "edicao";
  estado: PedidoEstado;
  quando: string;
  quem: string;
  observacao?: string;
  itensAnteriores?: PedidoItem[];
  freteAnterior?: number;
}

export interface Pedido {
  id: string;
  numero: string;
  clienteId: string;
  cliente: string;
  telefone: string;
  estado: PedidoEstado;
  criadoEm: string;
  itens: PedidoItem[];
  frete: number;
  endereco: string;
  enderecoMudou: boolean;
  historico: PedidoHistoricoEntrada[];
  comprovanteUrl?: string;
  comprovanteEnviadoEm?: string;
  valorComprovante?: number;
  ultimaRecusa?: PedidoUltimaRecusa;
}

export interface PedidoUltimaRecusa {
  motivo: string;
  quando: string;
  comprovanteUrl?: string;
}

export interface Categoria {
  id: string;
  nome: string;
  icone: string;
  fotoUrl?: string;
  fundo: string;
  ordem: number;
  ativa: boolean;
  qtdProdutos: number;
}

export interface CorTinta {
  id: string;
  codigo: string;
  nome: string;
  familia: string;
  hex: string;
  ativa: boolean;
}

export interface ProdutoVariacaoChave {
  cor: string;
  volume: string;
}

export interface ProdutoVariacao extends ProdutoVariacaoChave {
  preco: number;
  estoque: number;
  ativo: boolean;
}

export interface ProdutoCor {
  corId?: string;
  codigo?: string;
  nome: string;
  hex: string;
}

export interface Produto {
  id: string;
  nome: string;
  categoriaId: string;
  categoria: string;
  descricao: string;
  limiteEstoqueBaixo: number;
  descontoPct: number;
  ativo: boolean;
  cores: ProdutoCor[];
  volumes: string[];
  variacoes: Record<string, ProdutoVariacao>;
  specs: { nome: string; valor: string }[];
  fotos: { id: string; url: string }[];
}

export interface EnderecoCliente {
  id: string;
  rotulo: string;
  texto: string;
  principal: boolean;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  desde: string;
  enderecos: EnderecoCliente[];
  historicoEnderecos: string[];
}

export interface Cupom {
  id: string;
  codigo: string;
  tipo: "%" | "R$";
  valor: number;
  inicio: string;
  fim: string;
  limite: number | null;
  usos: number;
  ativo: boolean;
}

export interface BrandingConfig {
  logoUrl?: string;
  logoFormato: "quadrada" | "larga" | "vazia";
  bannerUrlWeb?: string;
  bannerUrlMobile?: string;
  bannerAtivo: boolean;
  bannerTitulo: string;
  bannerAltura: "baixa" | "media" | "alta";
  bannerOverlay: boolean;
  nomeLoja: string;
  corPrimaria: string;
  corSecundaria: string;
  contatoEmail: string;
  contatoTelefone: string;
  contatoInstagram: string;
  contatoFacebook: string;
  atualizadoEm?: string;
}

export interface PagamentoConfig {
  pix_tipo: string;
  pix_chave: string;
  pix_recebedor: string;
  pix_qr_url?: string;
  pix_instrucoes: string;
  pix_prazo_horas: number;
  motivos_recusa: string[];
  atualizado_em?: string;
}

export interface WhatsappConfig {
  numero: string;
  mensagem: string;
  atualizado_em?: string;
}

export interface FreteConfig {
  valor: number;
  gratis_acima: number;
  atualizado_em?: string;
}

export interface BuscasConfig {
  termos: string[];
  mostrar: boolean;
  atualizado_em?: string;
}

export interface LojaConfig {
  nome: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  estado: string;
  horarios: string;
  atualizado_em?: string;
}
