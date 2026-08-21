// Importa o catálogo de cores da Suvinil (scripts/cores-suvinil.json) para a
// coleção Firestore `cores`. Roda uma única vez, manualmente:
//
//   node scripts/importar-cores-suvinil.mjs
//
// Pede login (email/senha do ADMIN_EMAIL) no terminal antes de gravar.
// Nada é escrito sem essa autenticação.

import { readFileSync } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(join(__dirname, "..", ".env.local"));

const { initializeApp } = await import("firebase/app");
const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
const { getFirestore, collection, writeBatch, doc, getDocs } = await import(
  "firebase/firestore"
);

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const CODE_CTRL_C = 3;
const CODE_BACKSPACE_1 = 8;
const CODE_BACKSPACE_2 = 127;
const CODE_ENTER_CR = 13;
const CODE_ENTER_LF = 10;

function perguntaTexto(texto) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(texto, (resp) => {
      rl.close();
      resolve(resp);
    });
  });
}

function perguntaSenha(texto) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(texto);
    let senha = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char) => {
      const code = char.charCodeAt(0);
      if (code === CODE_ENTER_CR || code === CODE_ENTER_LF) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(senha);
        return;
      }
      if (code === CODE_CTRL_C) {
        process.stdout.write("\n");
        process.exit(1);
      }
      if (code === CODE_BACKSPACE_1 || code === CODE_BACKSPACE_2) {
        senha = senha.slice(0, -1);
        return;
      }
      senha += char;
    };
    stdin.on("data", onData);
  });
}

async function main() {
  console.log("=== Import do catálogo de cores Suvinil para Firestore ===\n");

  const jsonPath = join(__dirname, "cores-suvinil.json");
  const cores = JSON.parse(readFileSync(jsonPath, "utf8"));
  console.log(`Cores lidas de cores-suvinil.json: ${cores.length}\n`);

  const email = await perguntaTexto("Email de admin: ");
  const senha = await perguntaSenha("Senha: ");

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log("\nAutenticando...");
  await signInWithEmailAndPassword(auth, email.trim(), senha);
  console.log("Autenticado.\n");

  const coresRef = collection(db, "cores");

  console.log("Verificando cores já existentes na coleção `cores`...");
  const snapshot = await getDocs(coresRef);
  const existentes = new Set();
  snapshot.forEach((d) => existentes.add(d.data().codigo));
  console.log(`Documentos já existentes: ${existentes.size}\n`);

  const pendentes = cores.filter((c) => !existentes.has(c.codigo));
  console.log(`Cores a gravar (novas): ${pendentes.length}`);
  console.log(`Cores já presentes (puladas): ${cores.length - pendentes.length}\n`);

  if (pendentes.length === 0) {
    console.log("Nada a fazer — todas as cores já estão no Firestore.");
    process.exit(0);
  }

  const confirma = await perguntaTexto(
    `Confirma gravar ${pendentes.length} documentos na coleção "cores" do projeto "${firebaseConfig.projectId}"? (digite SIM para continuar): `
  );
  if (confirma.trim().toUpperCase() !== "SIM") {
    console.log("Cancelado pelo usuário.");
    process.exit(0);
  }

  const TAMANHO_LOTE = 450; // margem de segurança abaixo do limite de 500 do Firestore
  let gravados = 0;

  for (let i = 0; i < pendentes.length; i += TAMANHO_LOTE) {
    const lote = pendentes.slice(i, i + TAMANHO_LOTE);
    const batch = writeBatch(db);
    for (const cor of lote) {
      const novoDoc = doc(coresRef);
      batch.set(novoDoc, {
        codigo: cor.codigo,
        nome: cor.nome,
        familia: cor.familia,
        hex: cor.hex,
        ativa: true,
      });
    }
    await batch.commit();
    gravados += lote.length;
    console.log(`Gravados ${gravados}/${pendentes.length}...`);
  }

  console.log(`\nImport concluído. ${gravados} cores gravadas na coleção "cores".`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\nErro durante o import:", err.message || err);
  process.exit(1);
});
