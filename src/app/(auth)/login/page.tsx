"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, ADMIN_EMAIL } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { isValidEmail } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { fadeInDown, shake, spring } from "@/lib/animations";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [senhaError, setSenhaError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [errorShakeKey, setErrorShakeKey] = useState(0);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/produtos");
    }
  }, [authLoading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const nextEmailError = !email.trim()
      ? "Informe seu email"
      : !isValidEmail(email)
        ? "Email inválido"
        : "";
    const nextSenhaError = !senha ? "Informe sua senha" : senha.length < 8 ? "A senha precisa ter ao menos 8 caracteres" : "";

    setEmailError(nextEmailError);
    setSenhaError(nextSenhaError);
    setLoginError("");

    if (nextEmailError || nextSenhaError) {
      setErrorShakeKey((k) => k + 1);
      return;
    }

    setLoading(true);
    try {
      await setPersistence(auth, lembrar ? browserLocalPersistence : browserSessionPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), senha);
      if (credential.user.email?.toLowerCase() !== ADMIN_EMAIL) {
        await auth.signOut();
        setLoginError("Esta conta não tem acesso ao painel.");
        setErrorShakeKey((k) => k + 1);
        setLoading(false);
        return;
      }
      setLoading(false);
      setSuccess(true);
      setTimeout(() => router.replace("/produtos"), 550);
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      const message =
        code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
          ? "Email ou senha incorretos"
          : code === "auth/too-many-requests"
            ? "Muitas tentativas. Aguarde um instante e tente de novo."
            : "Não foi possível entrar. Tente novamente.";
      setLoginError(message);
      setErrorShakeKey((k) => k + 1);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <div className="flex w-full items-center px-20 py-12 md:w-[46%]">
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          onSubmit={onSubmit}
          className="flex w-full max-w-90 flex-col"
        >
          <div className="mb-10 flex h-11 w-11 items-center justify-center overflow-hidden rounded-[10px] bg-primary">
            <Image src="/logo-nova-era-tintas.png" alt="Nova Era Tintas" width={44} height={44} className="h-full w-full object-cover" />
          </div>
          <h1 className="m-0 text-[28px] font-semibold tracking-tight text-ink">Abrir a loja</h1>
          <p className="mb-8 mt-2 text-[15px] text-ink-soft text-pretty">
            Entre para gerenciar pedidos, comprovantes e estoque.
          </p>

          <label htmlFor="net-email" className="mb-1.5 text-[13px] font-medium text-ink">
            Email
          </label>
          <motion.div
            key={`email-${errorShakeKey}`}
            variants={shake}
            initial="initial"
            animate={emailError ? "shake" : "initial"}
          >
            <Input
              id="net-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@novaeratintas.com"
              error={!!emailError}
              className="h-11 text-[15px]"
            />
          </motion.div>
          <AnimatePresence>
            {emailError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-1.5 text-xs text-danger"
              >
                {emailError}
              </motion.div>
            )}
          </AnimatePresence>

          <label htmlFor="net-senha" className="mb-1.5 mt-5 text-[13px] font-medium text-ink">
            Senha
          </label>
          <motion.div
            key={`senha-${errorShakeKey}`}
            variants={shake}
            initial="initial"
            animate={senhaError ? "shake" : "initial"}
            className="relative flex"
          >
            <Input
              id="net-senha"
              type={verSenha ? "text" : "password"}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              error={!!senhaError}
              className="h-11 pr-11 text-[15px]"
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1 top-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-ink-soft transition-colors hover:text-ink"
            >
              {verSenha ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
            </button>
          </motion.div>
          <AnimatePresence>
            {senhaError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-1.5 text-xs text-danger"
              >
                {senhaError}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
              <motion.input
                type="checkbox"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
                whileTap={{ scale: 0.85 }}
                className="h-4 w-4 accent-primary"
              />
              Lembrar-me
            </label>
            <a href="#" className="text-[13px] font-normal text-ink-soft no-underline hover:underline">
              Esqueci minha senha
            </a>
          </div>

          <AnimatePresence>
            {loginError && (
              <motion.div
                key={`login-error-${errorShakeKey}`}
                variants={fadeInDown}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mt-7 flex items-center gap-2.5 rounded-lg border border-[#FDA29B] bg-danger-bg px-3.5 py-3"
              >
                <AlertCircle size={16} className="shrink-0 text-danger" strokeWidth={2} />
                <span className="text-sm text-danger">{loginError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={spring}
                className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-sans text-[15px] font-semibold text-white"
              >
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ ...spring, delay: 0.05 }}
                >
                  <CheckCircle2 size={18} strokeWidth={2.2} />
                </motion.span>
                Bem-vindo de volta!
              </motion.div>
            ) : (
              <motion.button
                key="submit"
                type="submit"
                disabled={loading}
                whileHover={loading ? undefined : { scale: 1.01 }}
                whileTap={loading ? undefined : { scale: 0.98 }}
                transition={spring}
                className="mt-7 flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border-0 bg-primary font-sans text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading && <Spinner className="h-3.5 w-3.5 border-white/35 border-t-white" />}
                {loading ? "Abrindo…" : "Abrir a loja"}
              </motion.button>
            )}
          </AnimatePresence>
        </motion.form>
      </div>

      <div
        className="relative hidden md:block md:w-[54%] bg-sidebar bg-cover bg-center"
        style={{ backgroundImage: "url('/wall-nova-era.png')" }}
      />
    </div>
  );
}
