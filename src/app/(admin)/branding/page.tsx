"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ImageOff, Check } from "lucide-react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal, ModalTitle, ModalBody } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { isValidHexColor, cn } from "@/lib/utils";
import { useCloudinaryUpload } from "@/lib/hooks/useCloudinaryUpload";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/cloudinary";

const PALETA = [
  "#0E7A2F", "#12B76A", "#00B20B", "#7CC243", "#C9D600", "#F2C200",
  "#F59E0B", "#E8721C", "#D92D20", "#B42318", "#C2255C", "#8B2C8F",
  "#5B34B5", "#3538CD", "#0088B7", "#0BA5C7", "#12A594", "#0F766E",
  "#8A5A2B", "#B98A50", "#D9C7A7", "#101828", "#667085", "#D0D5DD",
];

type LogoFormato = "quadrada" | "larga" | "vazia";
const ALTURAS = [
  { id: "baixa", nome: "Baixa" },
  { id: "media", nome: "Média" },
  { id: "alta", nome: "Alta" },
] as const;

function luminancia(hex: string) {
  const h = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function razaoBranco(hex: string) {
  const l = luminancia(hex);
  return l === null ? 21 : 1.05 / (l + 0.05);
}

export default function BrandingPage() {
  const { showToast } = useToast();
  const [atualizado, setAtualizado] = useState("06/08 às 14:32");

  const [logo, setLogo] = useState<LogoFormato>("quadrada");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [banner, setBanner] = useState(true);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const { upload: uploadLogo, uploading: enviandoLogo } = useCloudinaryUpload({
    folder: "nova-era-tintas/branding",
    onError: (message) => showToast(message),
  });
  const { upload: uploadBanner, uploading: enviandoBanner } = useCloudinaryUpload({
    folder: "nova-era-tintas/branding",
    onError: (message) => showToast(message),
  });
  const [bannerTitulo, setBannerTitulo] = useState("Semana da Tinta");
  const [bannerAltura, setBannerAltura] = useState<(typeof ALTURAS)[number]["id"]>("media");
  const [bannerOverlay, setBannerOverlay] = useState(true);
  const [nome, setNome] = useState("Nova Era Tintas");
  const [primaria, setPrimaria] = useState("#00B20B");
  const [secundaria, setSecundaria] = useState("#0088B7");
  const [picker, setPicker] = useState<null | "primaria" | "secundaria">(null);
  const [dialogo, setDialogo] = useState<null | "logo" | "banner">(null);
  const [contatoEd, setContatoEd] = useState(false);
  const [contato, setContato] = useState({
    email: "contato@novaeratintas.com.br",
    telefone: "(35) 3521-1234",
    instagram: "@novaeratintas",
    facebook: "novaeratintasitau",
  });
  const [contatoSnap, setContatoSnap] = useState(contato);
  const [primariaValid, setPrimariaValid] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (picker) setPicker(null);
      else if (dialogo) setDialogo(null);
    }
    function onPointerDown(e: PointerEvent) {
      if (!picker) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-picker]")) return;
      setPicker(null);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [picker, dialogo]);

  async function salvarBranding(msg: string, extra?: { email?: string; telefone?: string; instagram?: string; facebook?: string }) {
    setSalvando(true);
    try {
      const c = extra ?? contato;
      await setDoc(
        doc(db, "configuracoes", "branding"),
        {
          logo_url: logoUrl,
          banner_url: bannerUrl,
          descricao: bannerTitulo,
          telefone: c.telefone,
          email: c.email,
          redes_sociais: {
            instagram: c.instagram,
            facebook: c.facebook,
            tiktok: "",
          },
          atualizado_em: serverTimestamp(),
        },
        { merge: true }
      );
      showToast(msg);
      setAtualizado("agora");
    } catch {
      showToast("Não deu para salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const larga = logo === "larga";
  const temLogo = logo !== "vazia" && !!logoUrl;
  const razao = razaoBranco(primaria);
  const contrasteRuim = razao < 4.5;

  const bannerAlturaPx = bannerAltura === "baixa" ? 88 : bannerAltura === "alta" ? 168 : 124;

  return (
    <main className="min-w-0 flex-1 p-10">
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">Branding</h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">A cara da loja no app do cliente.</p>
      <div className="mt-2.5 flex items-center gap-1.75 text-[13px] text-ink-soft">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8v.1" />
        </svg>
        <span>O app pega a mudança em até 5 minutos · última atualização em {atualizado}</span>
      </div>

      <div className="mt-7 grid grid-cols-1 items-start gap-8 xl:grid-cols-[42fr_58fr]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Logo */}
          <section className="rounded-xl border border-border bg-white p-6">
            <div className="text-[17px] font-semibold">Logo</div>
            <div className="mt-1 text-[13px] text-ink-soft">Aparece na Home, no Login, no Cadastro e no Perfil.</div>
            <div className="mt-4.5 flex items-start gap-5">
              <div className="flex h-35 w-35 shrink-0 items-center justify-center rounded-[10px] border border-border bg-paper p-3">
                {temLogo ? (
                  <motion.div
                    key={logoUrl}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center overflow-hidden rounded"
                    style={{ width: larga ? 116 : 84, height: larga ? 40 : 84 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl!} alt="Logo da loja" className="h-full w-full object-contain" />
                  </motion.div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-2">
                    <ImageOff size={24} strokeWidth={1.6} className="text-ink-soft" />
                    <span className="text-center text-xs text-ink-soft">Envie a logo da loja</span>
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col items-start gap-2.5">
                <Button
                  variant="outline"
                  className="h-9.5"
                  loading={enviandoLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  Trocar logo
                </Button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const result = await uploadLogo(file);
                    if (result) {
                      setLogoUrl(result.url);
                      setLogo((l) => (l === "vazia" ? "quadrada" : l));
                    }
                  }}
                />
                {temLogo && (
                  <button type="button" onClick={() => setDialogo("logo")} className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-danger">
                    Remover
                  </button>
                )}
                <div className="text-xs text-ink-soft text-pretty">PNG, JPG ou WEBP, até 10MB. O ideal é 500×500px com fundo transparente.</div>
              </div>
            </div>
            <AnimatePresence>
              {larga && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 flex gap-2.5 overflow-hidden rounded-lg border border-status-amber/30 bg-status-amber-bg p-3"
                >
                  <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-status-amber" />
                  <span className="text-[13px] text-status-amber text-pretty">
                    Logo muito larga. Ela fica bem no topo da Home, mas some centralizada no Login. Veja o mostruário ao lado.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-4.5 flex justify-end">
              <Button className="h-10" loading={salvando} onClick={() => salvarBranding("Logo atualizada")}>
                Salvar
              </Button>
            </div>
          </section>

          {/* Banner */}
          <section className="rounded-xl border border-border bg-white p-6">
            <div className="text-[17px] font-semibold">Banner da Home</div>
            <div className="mt-1 text-[13px] text-ink-soft">A faixa grande no topo da Home. Boa pra promoção.</div>
            <motion.div
              className="relative mt-4 flex w-full items-center justify-center overflow-hidden rounded-[10px] border border-border bg-paper"
              animate={{ height: bannerAlturaPx }}
              transition={{ duration: 0.22 }}
            >
              {banner && bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              {banner && !bannerUrl && <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(45deg, #D0D5DD 0 8px, #E4E7EC 8px 16px)" }} />}
              {bannerOverlay && banner && <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(16,24,40,0.62), rgba(16,24,40,0.05))" }} />}
              {banner ? (
                <div
                  className="absolute left-5.5 top-1/2 -translate-y-1/2 text-lg font-bold text-white"
                  style={{ textShadow: bannerOverlay ? "none" : "0 1px 3px rgba(0,0,0,0.5)" }}
                >
                  {bannerTitulo}
                </div>
              ) : (
                <span className="relative text-[13px] text-ink-soft">Envie o banner da Home</span>
              )}
            </motion.div>
            <div className="mt-3.5 flex items-center gap-4">
              <Button variant="outline" className="h-9.5" loading={enviandoBanner} onClick={() => bannerInputRef.current?.click()}>
                Trocar imagem
              </Button>
              <input
                ref={bannerInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const result = await uploadBanner(file);
                  if (result) {
                    setBannerUrl(result.url);
                    setBanner(true);
                  }
                }}
              />
              {banner && bannerUrl && (
                <button type="button" onClick={() => setDialogo("banner")} className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-danger">
                  Remover
                </button>
              )}
            </div>
            <div className="mt-4.5 flex flex-col gap-1.5">
              <label htmlFor="bn-tit" className="text-[13px] font-medium">Texto sobre o banner</label>
              <Input id="bn-tit" value={bannerTitulo} onChange={(e) => setBannerTitulo(e.target.value)} placeholder="Semana da Tinta" />
            </div>
            <div className="mt-4.5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-[13px] font-medium">Altura</div>
                <div className="inline-flex overflow-hidden rounded-lg border border-border">
                  {ALTURAS.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setBannerAltura(a.id)}
                      className="cursor-pointer px-3.5 py-2 font-sans text-[13px] font-medium transition-colors"
                      style={{
                        background: bannerAltura === a.id ? "#12B76A" : "#fff",
                        color: bannerAltura === a.id ? "#fff" : "#667085",
                        borderLeft: i === 0 ? "0" : "1px solid #E4E7EC",
                      }}
                    >
                      {a.nome}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-2.5">
                <span>
                  <span className="block text-[13px] font-medium">Escurecer o fundo</span>
                  <span className="text-xs text-ink-soft">Deixa o texto legível sobre qualquer foto.</span>
                </span>
                <Switch checked={bannerOverlay} onChange={() => setBannerOverlay((v) => !v)} aria-label="Escurecer fundo do banner" />
              </label>
            </div>
            <div className="mt-3.5 text-xs text-ink-soft">JPG, PNG ou WEBP, até 10MB. O ideal é 1200×300px.</div>
            <div className="mt-4.5 flex justify-end">
              <Button className="h-10" loading={salvando} onClick={() => salvarBranding("Banner atualizado")}>
                Salvar
              </Button>
            </div>
          </section>

          {/* Nome da loja */}
          <section className="rounded-xl border border-border bg-white p-6">
            <div className="text-[17px] font-semibold">Nome da loja</div>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome da loja" className="mt-3.5" />
            <div className="mt-2 text-xs text-ink-soft">Aparece no topo da Home e nas telas de entrada.</div>
            <div className="mt-4.5 flex justify-end">
              <Button className="h-10" loading={salvando} onClick={() => salvarBranding("Nome salvo")}>
                Salvar
              </Button>
            </div>
          </section>

          {/* Cores */}
          <section className="rounded-xl border border-border bg-white p-6">
            <div className="text-[17px] font-semibold">Cores do app</div>
            <div className="mt-1 text-[13px] text-ink-soft text-pretty">Estas cores mudam o aplicativo do cliente. Este painel não muda.</div>
            <div className="mt-4.5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ColorField
                label="Cor primária"
                value={primaria}
                valid={primariaValid}
                onOpen={() => setPicker((p) => (p === "primaria" ? null : "primaria"))}
                open={picker === "primaria"}
                onHexChange={(v) => {
                  setPrimaria(v);
                  setPrimariaValid(isValidHexColor(v));
                }}
                hint="Botões, links e destaques."
                onChoose={(hex) => {
                  setPrimaria(hex);
                  setPrimariaValid(true);
                  setPicker(null);
                }}
              />
              <ColorField
                label="Cor secundária"
                value={secundaria}
                valid
                onOpen={() => setPicker((p) => (p === "secundaria" ? null : "secundaria"))}
                open={picker === "secundaria"}
                onHexChange={(v) => setSecundaria(v)}
                hint="Detalhes e apoio."
                onChoose={(hex) => {
                  setSecundaria(hex);
                  setPicker(null);
                }}
              />
            </div>
            <AnimatePresence>
              {contrasteRuim && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 flex gap-2.5 overflow-hidden rounded-lg border border-status-amber/30 bg-status-amber-bg p-3"
                >
                  <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-status-amber" />
                  <span className="text-[13px] text-status-amber text-pretty">O texto branco dos botões vai ficar difícil de ler nessa cor.</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-4.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setPrimaria("#00B20B");
                  setSecundaria("#0088B7");
                  setPrimariaValid(true);
                }}
                className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-ink-soft"
              >
                Voltar ao padrão
              </button>
              <Button className="h-10" loading={salvando} onClick={() => salvarBranding("Cores atualizadas")}>
                Salvar
              </Button>
            </div>
          </section>

          {/* Contato */}
          <section className="rounded-xl border border-border bg-white p-6">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="text-[17px] font-semibold">Contato e redes</div>
                <div className="mt-1 text-[13px] text-ink-soft">O que aparece no rodapé do app e na tela de contato.</div>
              </div>
              {!contatoEd && (
                <button
                  type="button"
                  onClick={() => {
                    setContatoSnap(contato);
                    setContatoEd(true);
                  }}
                  className="shrink-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-primary"
                >
                  Editar
                </button>
              )}
            </div>

            {!contatoEd ? (
              <div className="mt-5 grid grid-cols-1 gap-4.5 sm:grid-cols-2">
                <ContatoField label="E-mail" value={contato.email} />
                <ContatoField label="Telefone" value={contato.telefone} mono />
                <ContatoField label="Instagram" value={contato.instagram} />
                <ContatoField label="Facebook" value={contato.facebook} />
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4.5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ct-email" className="text-[13px] font-medium">E-mail</label>
                  <Input id="ct-email" value={contato.email} onChange={(e) => setContato((c) => ({ ...c, email: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ct-tel" className="text-[13px] font-medium">Telefone</label>
                  <Input id="ct-tel" value={contato.telefone} onChange={(e) => setContato((c) => ({ ...c, telefone: e.target.value }))} className="font-mono" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ct-ig" className="text-[13px] font-medium">Instagram</label>
                  <Input id="ct-ig" value={contato.instagram} onChange={(e) => setContato((c) => ({ ...c, instagram: e.target.value }))} placeholder="@sualoja" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ct-fb" className="text-[13px] font-medium">Facebook</label>
                  <Input id="ct-fb" value={contato.facebook} onChange={(e) => setContato((c) => ({ ...c, facebook: e.target.value }))} placeholder="sualoja" />
                </div>
              </div>
            )}
            {contatoEd && (
              <div className="mt-5 flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setContato(contatoSnap);
                    setContatoEd(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="h-10"
                  loading={salvando}
                  onClick={async () => {
                    await salvarBranding("Contato salvo", contato);
                    setContatoEd(false);
                  }}
                >
                  Salvar
                </Button>
              </div>
            )}
          </section>
        </div>

        <div className="sticky top-10 min-w-0 rounded-xl border border-border bg-white p-6">
          <div className="text-xs font-medium uppercase tracking-wider text-ink-soft">O que o cliente vê</div>
          <div className="mt-4.5 flex gap-4 overflow-x-auto pb-1.5">
            <MockupPhone label="Home">
              <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.75">
                {temLogo && (
                  <span
                    className="shrink-0 rounded-sm"
                    style={{ width: larga ? 34 : 12, height: 12, background: "repeating-linear-gradient(45deg, #D0D5DD 0 4px, #E4E7EC 4px 8px)" }}
                  />
                )}
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[7px] font-semibold">{nome}</span>
              </div>
              {banner && <div className="m-1.5 h-6.5 shrink-0 rounded" style={{ background: "repeating-linear-gradient(45deg, #D0D5DD 0 5px, #E4E7EC 5px 10px)" }} />}
              <div className="grid grid-cols-2 gap-1.25 px-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-7.5 rounded bg-paper" />
                ))}
              </div>
              <div
                className="mx-1.5 mb-2 mt-auto flex h-4.5 items-center justify-center rounded text-[7px] font-semibold"
                style={{ background: primaria, color: "#fff" }}
              >
                Ver catálogo
              </div>
            </MockupPhone>

            <MockupPhone label="Login">
              <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
                {temLogo ? (
                  <span
                    className="shrink-0 rounded"
                    style={{ width: larga ? 84 : 46, height: larga ? 29 : 46, background: "repeating-linear-gradient(45deg, #D0D5DD 0 5px, #E4E7EC 5px 10px)" }}
                  />
                ) : (
                  <span className="text-center text-[11px] font-semibold">{nome}</span>
                )}
                <div className="mt-1.5 h-4 w-full rounded border border-border" />
                <div className="h-4 w-full rounded border border-border" />
                <div className="flex h-4.5 w-full items-center justify-center rounded text-[7px] font-semibold" style={{ background: primaria, color: "#fff" }}>
                  Entrar
                </div>
                <span className="text-[7px]" style={{ color: secundaria }}>Criar conta</span>
              </div>
            </MockupPhone>

            <MockupPhone label="Cadastro">
              <div className="flex h-full flex-col items-center gap-1.5 p-3 pt-3.5">
                {temLogo ? (
                  <span
                    className="shrink-0 rounded"
                    style={{ width: larga ? 68 : 34, height: larga ? 24 : 34, background: "repeating-linear-gradient(45deg, #D0D5DD 0 5px, #E4E7EC 5px 10px)" }}
                  />
                ) : (
                  <span className="text-center text-[10px] font-semibold">{nome}</span>
                )}
                <div className="mt-1 h-3.5 w-full rounded border border-border" />
                <div className="h-3.5 w-full rounded border border-border" />
                <div className="h-3.5 w-full rounded border border-border" />
                <div className="h-3.5 w-full rounded border border-border" />
                <div className="flex h-4.5 w-full items-center justify-center rounded text-[7px] font-semibold" style={{ background: primaria, color: "#fff" }}>
                  Criar conta
                </div>
              </div>
            </MockupPhone>

            <MockupPhone label="Perfil">
              <div
                className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-b-[18px] p-1.5"
                style={{ height: 58, background: primaria }}
              >
                {temLogo && <span className="h-2.75 rounded-sm bg-white/85" style={{ width: larga ? 34 : 12 }} />}
                <span className="text-[7px] font-semibold text-white">{nome}</span>
              </div>
              <div className="mx-auto -mt-3.75 h-7.5 w-7.5 rounded-full border-2 border-white bg-paper" />
              <div className="flex flex-col gap-1.25 px-2 pt-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-3.25 rounded bg-paper" />
                ))}
              </div>
            </MockupPhone>
          </div>
        </div>
      </div>

      <Modal open={!!dialogo} onClose={() => setDialogo(null)} maxWidth={420}>
        <ModalTitle>{dialogo === "banner" ? "Remover o banner?" : "Remover a logo?"}</ModalTitle>
        <ModalBody>
          {dialogo === "banner" ? "A Home fica sem a faixa de promoção no topo." : "O app volta a mostrar só o nome da loja."}
        </ModalBody>
        <div className="mt-5.5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDialogo(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={salvando}
            onClick={async () => {
              const alvo = dialogo;
              setDialogo(null);
              setSalvando(true);
              try {
                await setDoc(
                  doc(db, "configuracoes", "branding"),
                  {
                    logo_url: alvo === "logo" ? null : logoUrl,
                    banner_url: alvo === "banner" ? null : bannerUrl,
                    descricao: bannerTitulo,
                    telefone: contato.telefone,
                    email: contato.email,
                    redes_sociais: { instagram: contato.instagram, facebook: contato.facebook, tiktok: "" },
                    atualizado_em: serverTimestamp(),
                  },
                  { merge: true }
                );
                if (alvo === "banner") {
                  setBanner(false);
                  setBannerUrl(null);
                } else {
                  setLogo("vazia");
                  setLogoUrl(null);
                }
                showToast(alvo === "banner" ? "Banner removido" : "Logo removida");
                setAtualizado("agora");
              } catch {
                showToast("Não deu para remover. Tente de novo.");
              } finally {
                setSalvando(false);
              }
            }}
          >
            Remover
          </Button>
        </div>
      </Modal>
    </main>
  );
}

function ColorField({
  label,
  value,
  valid,
  open,
  onOpen,
  onHexChange,
  onChoose,
  hint,
}: {
  label: string;
  value: string;
  valid: boolean;
  open: boolean;
  onOpen: () => void;
  onHexChange: (v: string) => void;
  onChoose: (hex: string) => void;
  hint: string;
}) {
  return (
    <div>
      <div className="text-[13px] font-medium">{label}</div>
      <div data-picker="1">
        <div className="mt-2 flex items-center gap-2.5">
          <motion.button
            type="button"
            onClick={onOpen}
            aria-label={`Escolher ${label.toLowerCase()}`}
            aria-expanded={open}
            whileHover={{ scale: 1.06 }}
            className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-black/10 p-0"
            style={{ background: value, boxShadow: open ? "0 0 0 3px rgba(18,183,106,0.18)" : "none" }}
          />
          <Input
            value={value}
            onChange={(e) => onHexChange(e.target.value)}
            aria-label={`Hex da ${label.toLowerCase()}`}
            error={!valid}
            className="h-8.5 flex-1 font-mono text-sm"
          />
          {valid && <Check size={15} className="shrink-0 text-primary" strokeWidth={2.4} />}
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              className="mt-2.5 rounded-[10px] border border-border bg-paper p-2.5"
            >
              <div className="grid grid-cols-6 gap-1.5">
                {PALETA.map((hex, i) => (
                  <motion.button
                    key={hex}
                    type="button"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.012 }}
                    whileHover={{ scale: 1.12, boxShadow: "0 0 0 2px rgba(16,24,40,0.15)" }}
                    onClick={() => onChoose(hex)}
                    aria-label={hex}
                    className="aspect-square w-full cursor-pointer rounded-[5px] border border-black/12 p-0"
                    style={{ background: hex }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-2 text-xs text-ink-soft">{hint}</div>
    </div>
  );
}

function ContatoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[13px] text-ink-soft">{label}</div>
      <div className={cn("mt-0.5 overflow-hidden text-ellipsis text-[15px]", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function MockupPhone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="flex w-30 flex-col overflow-hidden rounded-2xl border-6 border-ink bg-white" style={{ aspectRatio: "9 / 19" }}>
        {children}
      </div>
      <span className="text-xs text-ink-soft">{label}</span>
    </div>
  );
}
