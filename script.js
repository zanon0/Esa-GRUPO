/* =====================================
   STUDYRANK - VERSÃO FIREBASE
   Ranking compartilhado em tempo real!
===================================== */

// =====================================
// CONFIGURAÇÃO DO FIREBASE
// =====================================

const firebaseConfig = {
  apiKey: "AIzaSyBSMxEm9jfv0P8c2lJqPHLEdvmUVz-YHiw",
  authDomain: "grupo-esa-2027.firebaseapp.com",
  projectId: "grupo-esa-2027",
  storageBucket: "grupo-esa-2027.firebasestorage.app",
  messagingSenderId: "288746327635",
  appId: "1:288746327635:web:fbb19c27db74f135dcc0a6",
  measurementId: "G-5RN3G49501"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =====================================
// VARIÁVEIS GLOBAIS
// =====================================

let usuarioAtual = null;
let usuarioData = null;
let segundosSessao = 0;
let intervalo = null;
let estudando = false;
let rankingAtual = [];
let semanaAtual = '';
let tempoEnviadoFirebase = 0; // ✅ Controla quanto já foi enviado

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
});

// =====================================
// TELAS DE AUTENTICAÇÃO
// =====================================

function mostrarCadastro() {
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("cadastroForm").classList.remove("hidden");
    document.getElementById("loginMensagem").innerText = "";
}

function mostrarLogin() {
    document.getElementById("cadastroForm").classList.add("hidden");
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("cadastroMensagem").innerText = "";
}

// =====================================
// CADASTRO
// =====================================

async function cadastrar() {
    const nome = document.getElementById("cadNome").value.trim();
    const email = document.getElementById("cadEmail").value.trim();
    const senha = document.getElementById("cadSenha").value;
    const mensagem = document.getElementById("cadastroMensagem");

    if (!nome || !email || !senha) {
        mensagem.innerText = "Preencha todos os campos.";
        mensagem.style.color = "#ff7676";
        return;
    }

    if (senha.length < 6) {
        mensagem.innerText = "A senha precisa ter pelo menos 6 caracteres.";
        mensagem.style.color = "#ff7676";
        return;
    }

    try {
        mensagem.innerText = "Criando conta...";
        mensagem.style.color = "#7ee787";

        const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
        const user = userCredential.user;

        await db.collection("usuarios").doc(user.uid).set({
            uid: user.uid,
            nome: nome,
            email: email,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection("ranking").doc(user.uid).set({
            uid: user.uid,
            nome: nome,
            tempo: 0,
            semana: obterSemanaAtual()
        });

        mensagem.innerText = "Cadastro realizado com sucesso!";
        mensagem.style.color = "#7ee787";

        setTimeout(() => {
            mostrarLogin();
            document.getElementById("loginEmail").value = email;
        }, 1500);

    } catch (error) {
        console.error("Erro no cadastro:", error);
        mensagem.innerText = error.message;
        mensagem.style.color = "#ff7676";
    }
}

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
        console.error("Erro no login:", error);
        mensagem.innerText = "E-mail ou senha incorretos.";
        mensagem.style.color = "#ff7676";
    }
}

// =====================================
// CARREGAR DADOS DO USUÁRIO
// =====================================

async function carregarDadosUsuario(user) {
    try {
        const doc = await db.collection("usuarios").doc(user.uid).get();
        if (doc.exists) {
            usuarioData = doc.data();
            usuarioAtual = {
                uid: user.uid,
                ...usuarioData
            };
        } else {
            await db.collection("usuarios").doc(user.uid).set({
                uid: user.uid,
                nome: user.displayName || user.email.split('@')[0],
                email: user.email,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            usuarioAtual = {
                uid: user.uid,
                nome: user.displayName || user.email.split('@')[0],
                email: user.email
            };
        }

        semanaAtual = obterSemanaAtual();
        await carregarRanking();

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
        usuarioData = null;

        if (intervalo) {
            clearInterval(intervalo);
            intervalo = null;
        }
        segundosSessao = 0;
        tempoEnviadoFirebase = 0;
        estudando = false;

        document.getElementById("appScreen").classList.add("hidden");
        document.getElementById("authScreen").classList.remove("hidden");
        mostrarLogin();

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

// =====================================
// TROCAR PÁGINA
// =====================================

function mostrarPagina(pagina) {
    fecharMenu();

    document.getElementById("paginaCronometro").classList.add("hidden");
    document.getElementById("paginaRanking").classList.add("hidden");
    document.getElementById("paginaHistorico").classList.add("hidden");

    if (pagina === "cronometro") {
        document.getElementById("paginaCronometro").classList.remove("hidden");
    } else if (pagina === "ranking") {
        document.getElementById("paginaRanking").classList.remove("hidden");
        carregarRanking();
    } else if (pagina === "historico") {
        document.getElementById("paginaHistorico").classList.remove("hidden");
        carregarHistorico();
    }
}

// =====================================
// CRONÔMETRO - CORRIGIDO ✅
// =====================================

function iniciar() {
    if (!usuarioAtual || estudando) return;

    estudando = true;
    tempoEnviadoFirebase = 0; // ✅ Reseta
    document.getElementById("statusTimer").innerText = "Estudando agora...";
    document.getElementById("startButton").innerText = "● Estudando";

    intervalo = setInterval(async () => {
        segundosSessao++;
        atualizarTimer();

        // ✅ Envia APENAS 1 segundo por vez (a cada 5 segundos, envia 5)
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
        // ✅ Envia o que falta
        const diff = segundosSessao - tempoEnviadoFirebase;
        if (diff > 0) {
            await atualizarTempoFirebase(diff);
        }

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

        } catch (error) {
            console.error("Erro ao salvar sessão:", error);
        }
    }

    segundosSessao = 0;
    tempoEnviadoFirebase = 0;
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
    document.getElementById("timer").innerText =
        `${formatar(h)}:${formatar(m)}:${formatar(s)}`;
}

function formatar(numero) {
    return String(numero).padStart(2, "0");
}

// =====================================
// FIREBASE - ATUALIZAR TEMPO (CORRIGIDO) ✅
// =====================================

async function atualizarTempoFirebase(tempoAdicional) {
    if (!usuarioAtual || tempoAdicional <= 0) return;

    console.log(`Enviando ${tempoAdicional} segundos para o Firebase`);

    try {
        const docRef = db.collection("ranking").doc(usuarioAtual.uid);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            if (data.semana !== semanaAtual) {
                // Nova semana: reseta
                await docRef.update({
                    tempo: tempoAdicional,
                    semana: semanaAtual,
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // ✅ Adiciona APENAS os segundos novos
                await docRef.update({
                    tempo: firebase.firestore.FieldValue.increment(tempoAdicional),
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } else {
            await docRef.set({
                uid: usuarioAtual.uid,
                nome: usuarioAtual.nome,
                tempo: tempoAdicional,
                semana: semanaAtual,
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Erro ao atualizar ranking:", error);
    }
}

// =====================================
// FIREBASE - CARREGAR RANKING
// =====================================

async function carregarRanking() {
    try {
        const snapshot = await db.collection("ranking")
            .where("semana", "==", semanaAtual)
            .orderBy("tempo", "desc")
            .get();

        rankingAtual = [];
        snapshot.forEach(doc => {
            rankingAtual.push({
                id: doc.id,
                ...doc.data()
            });
        });

        atualizarRanking();

    } catch (error) {
        console.error("Erro ao carregar ranking:", error);
        try {
            const snapshot = await db.collection("ranking")
                .where("semana", "==", semanaAtual)
                .get();
            
            rankingAtual = [];
            snapshot.forEach(doc => {
                rankingAtual.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            rankingAtual.sort((a, b) => b.tempo - a.tempo);
            atualizarRanking();
        } catch (e2) {
            console.error("Erro no fallback do ranking:", e2);
        }
    }
}

// =====================================
// EXIBIR RANKING
// =====================================

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
        linha.className = "ranking-row";

        if (usuarioAtual && jogador.uid === usuarioAtual.uid) {
            linha.style.background = "#292929";
            linha.style.borderLeft = "3px solid #4CAF50";
        }

        const nome = jogador.nome || jogador.uid || "Anônimo";

        linha.innerHTML = `
            <div class="ranking-position">${obterMedalha(index)}</div>
            <div class="ranking-name">${escaparHTML(nome)}</div>
            <div class="ranking-time">${formatarTempo(jogador.tempo || 0)}</div>
        `;

        lista.appendChild(linha);
    });

    atualizarPosicao();
}

function obterMedalha(posicao) {
    if (posicao === 0) return "🥇";
    if (posicao === 1) return "🥈";
    if (posicao === 2) return "🥉";
    return `${posicao + 1}º`;
}

function formatarTempo(segundos) {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);

    if (horas > 0) {
        return `${horas}h ${String(minutos).padStart(2, "0")}min`;
    }
    return `${minutos}min`;
}

function formatarTempoCompleto(segundos) {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;

    if (h > 0) return `${h}h ${m}min ${s}s`;
    if (m > 0) return `${m}min ${s}s`;
    return `${s}s`;
}

function atualizarPosicao() {
    if (!usuarioAtual) return;

    const posicao = rankingAtual.findIndex(r => r.uid === usuarioAtual.uid);
    const elemento = document.getElementById("posicaoAtual");

    if (posicao === -1 || rankingAtual.length === 0) {
        elemento.innerText = "-";
    } else {
        elemento.innerText = `${posicao + 1}º`;
    }
}

// =====================================
// FIREBASE - CARREGAR HISTÓRICO
// =====================================

async function carregarHistorico() {
    if (!usuarioAtual) return;

    try {
        const snapshot = await db.collection("historico")
            .where("uid", "==", usuarioAtual.uid)
            .orderBy("timestamp", "desc")
            .limit(100)
            .get();

        const historico = [];
        snapshot.forEach(doc => {
            historico.push({
                id: doc.id,
                ...doc.data()
            });
        });

        atualizarHistorico(historico);

    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
    }
}

// =====================================
// EXIBIR HISTÓRICO
// =====================================

function atualizarHistorico(historico) {
    const lista = document.getElementById("listaHistorico");
    if (!lista) return;

    lista.innerHTML = "";

    if (historico.length === 0) {
        lista.innerHTML = `
            <div class="history-row">
                <span class="history-date">Nenhuma sessão registrada.</span>
            </div>
        `;
        return;
    }

    historico.forEach(sessao => {
        const div = document.createElement("div");
        div.className = "history-row";
        div.innerHTML = `
            <span class="history-date">${sessao.data || 'Data não disponível'}</span>
            <span class="history-time">${formatarTempoCompleto(sessao.tempo || 0)}</span>
        `;
        lista.appendChild(div);
    });
}

// =====================================
// INTERFACE
// =====================================

function atualizarInterface() {
    if (!usuarioAtual) return;

    const meuRanking = rankingAtual.find(r => r.uid === usuarioAtual.uid);
    if (meuRanking) {
        document.getElementById("tempoSemana").innerText = formatarTempo(meuRanking.tempo || 0);
    }

    carregarTempoHoje();
    atualizarPosicao();
}

async function carregarTempoHoje() {
    if (!usuarioAtual) return;

    try {
        const hoje = new Date().toLocaleDateString("pt-BR");
        const snapshot = await db.collection("historico")
            .where("uid", "==", usuarioAtual.uid)
            .where("data", "==", hoje)
            .get();

        let total = 0;
        snapshot.forEach(doc => {
            total += doc.data().tempo || 0;
        });

        document.getElementById("tempoHoje").innerText = formatarTempo(total);

    } catch (error) {
        console.error("Erro ao carregar tempo de hoje:", error);
    }
}

// =====================================
// UTILITÁRIOS
// =====================================

function obterSemanaAtual() {
    const data = new Date();
    const primeiroDia = new Date(data.getFullYear(), 0, 1);
    const dias = Math.floor((data - primeiroDia) / 86400000);
    return data.getFullYear() + "-" + Math.ceil((dias + primeiroDia.getDay() + 1) / 7);
}

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

// =====================================
// RECARREGAR RANKING A CADA 30 SEGUNDOS
// =====================================

setInterval(() => {
    if (usuarioAtual) {
        carregarRanking();
    }
}, 30000);