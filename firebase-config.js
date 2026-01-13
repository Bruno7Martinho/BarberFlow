// CONFIGURAÇÃO SIMPLES DO FIREBASE
console.log('Carregando configuração do Firebase...');

// Esperar Firebase SDK carregar
setTimeout(function() {
    if (typeof firebase === 'undefined') {
        console.error('ERRO: Firebase não carregou');
        return;
    }
    
    const firebaseConfig = {
        apiKey: "AIzaSyDIqJpw0EnBnkZWvXIbMQIxai394lsqAKA",
        authDomain: "barbearia-84d78.firebaseapp.com",
        projectId: "barbearia-84d78",
        storageBucket: "barbearia-84d78.firebasestorage.app",
        messagingSenderId: "42251761510",
        appId: "1:42251761510:web:03e036a25931a461c43aa7"
    };
    
    try {
        // Inicializar
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase inicializado!');
        
        // Tornar global
        window.auth = firebase.auth();
        window.db = firebase.firestore();
        
        // Iniciar verificação de autenticação
        startAuthCheck();
        
    } catch (error) {
        console.error('❌ Erro Firebase:', error);
    }
}, 1000); // Dar 1 segundo para SDK carregar

function startAuthCheck() {
    if (!window.auth) {
        setTimeout(startAuthCheck, 100);
        return;
    }
    
    // Verificar se NÃO é página de login
    if (!window.location.href.includes('login.html')) {
        window.auth.onAuthStateChanged(function(user) {
            if (!user) {
                console.log('Redirecionando para login...');
                window.location.href = 'login.html';
            } else {
                console.log('Usuário logado:', user.email);
                // Atualizar nome
                const userNameEl = document.getElementById('userName');
                if (userNameEl) userNameEl.textContent = user.email;
            }
        });
    }
}

// Função logout global
window.logout = function() {
    if (window.auth) {
        window.auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    }
};