/* =====================================
   MYSTUDY - Versão Firebase
===================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBSMxEm9jfv0P8c2lJqPHLEdvmUVz-YHiw",
  authDomain: "grupo-esa-2027.firebaseapp.com",
  projectId: "grupo-esa-2027",
  storageBucket: "grupo-esa-2027.firebasestorage.app",
  messagingSenderId: "288746327635",
  appId: "1:288746327635:web:fbb19c27db74f135dcc0a6",
  measurementId: "G-5RN3G49501"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =====================================
// VARIÁVEIS
// =====================================

let usuarioAtual = null;
let segundosSessao = 0;
let intervalo = null;
let estudando = false;
let rankingAtual = [];
let semanaAtual = '';
let tempoEnviadoFirebase = 0;
let semanaAnteriorTotal = 0;
let semanaAtualTotal = 0;

// =====================================
// INICIALIZAÇÃO
// =====================================

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await carregarDadosUsuario(user);
            abrirAplicativo();
        } else {
            document.getElementById("authScreen").classList.remove("hidden");
            document.getElementById("appScreen").classList.add("hidden");
        }
    });
    setInterval(verificarResetSemanal, 60000);
});

// =====================================
// LOGIN
// =====================================

async function login() {
    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginSenha").value;
    const mensagem = document.getElementById("loginMensagem");

    if (!email || !senha) {
        mensagem.innerText = "Preencha e-mail e senha.";
        mensagem.style.color = "#ff7676";
        return;
    }

    try {
        mensagem.innerText = "Entrando...";
        mensagem.style.color = "#7ee787";
        await auth.signInWithEmailAndPassword(email, senha);
        mensagem.innerText = "Login realizado!";
        mensagem.style.color = "#7ee787";
    } catch (error) {
        mensagem.innerText = "E-mail ou senha incorretos.";
        mensagem.style.color = "#ff7676";
    }
}

// =====================================
// CARREGAR DADOS
// =====================================

async function carregarDadosUsuario(user) {
    try {
        const doc = await db.collection("usuarios").doc(user.uid).get();
        if (doc.exists) {
            usuarioAtual = { uid: user.uid, ...doc.data() };
        } else {
            const nome = user.displayName || user.email.split('@')[0];
            await db.collection("usuarios").doc(user.uid).set({
                uid: user.uid,
                nome: nome,
                email: user.email,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            usuarioAtual = { uid: user.uid, nome: nome, email: user.email };
        }

        semanaAtual = obterSemanaAtual();
        await carregarRanking();
        await carregarHistorico();
        await carregarTempoHoje();
        await carregarComparacaoSemanal();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

// =====================================
// ABRIR APLICATIVO
// =====================================

function abrirAplicativo() {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appScreen").classList.remove("hidden");
    document.getElementById("usuarioNome").innerText = usuarioAtual.nome;
    document.getElementById("menuUsuario").innerText = usuarioAtual.nome;
    document.getElementById("nomeWelcome").innerText = usuarioAtual.nome;
    atualizarInterface();
}

// =====================================
// LOGOUT
// =====================================

async function logout() {
    if (estudando) {
        alert("Finalize sua sessão de estudos antes de sair.");
        return;
    }
    try {
        await auth.signOut();
        usuarioAtual = null;
        if (intervalo) { clearInterval(intervalo); intervalo = null; }
        segundosSessao = 0;
        estudando = false;
        document.getElementById("appScreen").classList.add("hidden");
        document.getElementById("authScreen").classList.remove("hidden");
        document.getElementById("timer").innerText = "00:00:00";
        document.getElementById("statusTimer").innerText = "Pronto para estudar";
        document.getElementById("startButton").innerText = "▶ Iniciar";
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}

// =====================================
// MENU
// =====================================

function abrirMenu() {
    document.getElementById("sideMenu").classList.add("open");
    document.getElementById("menuOverlay").classList.remove("hidden");
}

function fecharMenu() {
    document.getElementById("sideMenu").classList.remove("open");
    document.getElementById("menuOverlay").classList.add("hidden");
}

function mostrarPagina(pagina) {
    fecharMenu();
    document.getElementById("paginaCronometro").classList.add("hidden");
    document.getElementById("paginaRanking").classList.add("hidden");
    document.getElementById("paginaHistorico").classList.add("hidden");

    if (pagina === "cronometro") {
        document.getElementById("paginaCronometro").classList.remove("hidden");
        carregarComparacaoSemanal();
    } else if (pagina === "ranking") {
        document.getElementById("paginaRanking").classList.remove("hidden");
        carregarRanking();
    } else if (pagina === "historico") {
        document.getElementById("paginaHistorico").classList.remove("hidden");
        carregarHistorico();
    }
}

// =====================================
// CRONÔMETRO
// =====================================

function iniciar() {
    if (!usuarioAtual || estudando) return;
    estudando = true;
    tempoEnviadoFirebase = 0;
    document.getElementById("statusTimer").innerText = "Estudando agora...";
    document.getElementById("startButton").innerText = "● Estudando";

    intervalo = setInterval(async () => {
        segundosSessao++;
        atualizarTimer();
        const diff = segundosSessao - tempoEnviadoFirebase;
        if (diff >= 5) {
            await atualizarTempoFirebase(diff);
            tempoEnviadoFirebase = segundosSessao;
        }
    }, 1000);
}

function pausar() {
    if (!estudando) return;
    clearInterval(intervalo);
    intervalo = null;
    estudando = false;
    document.getElementById("statusTimer").innerText = "Estudo pausado";
    document.getElementById("startButton").innerText = "▶ Continuar";
}

async function encerrar() {
    if (!usuarioAtual) return;
    clearInterval(intervalo);
    intervalo = null;

    if (segundosSessao > 0) {
        const diff = segundosSessao - tempoEnviadoFirebase;
        if (diff > 0) { await atualizarTempoFirebase(diff); }
        try {
            await db.collection("historico").add({
                uid: usuarioAtual.uid,
                nome: usuarioAtual.nome,
                tempo: segundosSessao,
                data: new Date().toLocaleDateString("pt-BR"),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            await carregarRanking();
            await carregarHistorico();
            await carregarTempoHoje();
            await carregarComparacaoSemanal();
        } catch (error) {
            console.error("Erro ao salvar sessão:", error);
        }
    }
    segundosSessao = 0;
    estudando = false;
    document.getElementById("statusTimer").innerText = "Sessão encerrada";
    document.getElementById("startButton").innerText = "▶ Iniciar";
    atualizarTimer();
    atualizarInterface();
}

function atualizarTimer() {
    const h = Math.floor(segundosSessao / 3600);
    const m = Math.floor((segundosSessao % 3600) / 60);
    const s = segundosSessao % 60;
    document.getElementById("timer").innerText = `${formatar(h)}:${formatar(m)}:${formatar(s)}`;
}

function formatar(numero) { return String(numero).padStart(2, "0"); }

// =====================================
// RANKING
// =====================================

async function atualizarTempoFirebase(tempoAdicional) {
    if (!usuarioAtual || tempoAdicional <= 0) return;
    try {
        const docRef = db.collection("ranking").doc(usuarioAtual.uid);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            if (data.semana !== semanaAtual) {
                await docRef.update({ tempo: tempoAdicional, semana: semanaAtual, ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp() });
            } else {
                await docRef.update({ tempo: firebase.firestore.FieldValue.increment(tempoAdicional), ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp() });
            }
        } else {
            await docRef.set({ uid: usuarioAtual.uid, nome: usuarioAtual.nome, tempo: tempoAdicional, semana: semanaAtual, ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp() });
        }
    } catch (error) {
        console.error("Erro ao atualizar ranking:", error);
    }
}

async function carregarRanking() {
    try {
        const snapshot = await db.collection("ranking").where("semana", "==", semanaAtual).get();
        rankingAtual = [];
        snapshot.forEach(doc => { rankingAtual.push({ id: doc.id, ...doc.data() }); });
        rankingAtual.sort((a, b) => b.tempo - a.tempo);
        atualizarRanking();
    } catch (error) {
        console.error("Erro ao carregar ranking:", error);
    }
}

function atualizarRanking() {
    const lista = document.getElementById("listaRanking");
    if (!lista) return;

    lista.innerHTML = "";

    if (rankingAtual.length === 0) {
        lista.innerHTML = `
            <div class="ranking-row">
                <div class="ranking-position">-</div>
                <div class="ranking-name">Nenhum registro esta semana</div>
                <div class="ranking-time">0min</div>
            </div>
        `;
        return;
    }

    rankingAtual.forEach((jogador, index) => {
        const linha = document.createElement("div");
        linha