// auth.js MINIMAL
console.log('Auth.js carregado');

// A verificação de auth já está no firebase-config.js
// Esta função só é chamada pelos botões
function logout() {
    if (window.auth) {
        window.auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    } else {
        // Fallback
        firebase.auth().signOut().then(() => {
            window.location.href = 'login.html';
        });
    }
}


// No final do auth.js, adicione:
function initializeMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const menuOverlay = document.getElementById('menuOverlay');
    const navbar = document.querySelector('.navbar');
    
    if (menuToggle && navbar) {
        menuToggle.addEventListener('click', function() {
            navbar.classList.toggle('active');
            if (menuOverlay) {
                menuOverlay.classList.toggle('active');
            }
        });
        
        if (menuOverlay) {
            menuOverlay.addEventListener('click', function() {
                navbar.classList.remove('active');
                menuOverlay.classList.remove('active');
            });
        }
        
        // Fechar menu ao clicar em um link
        const navLinks = document.querySelectorAll('.navbar a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navbar.classList.remove('active');
                if (menuOverlay) {
                    menuOverlay.classList.remove('active');
                }
            });
        });
    }
}

// Chame no final da inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Seu código existente...
    initializeMobileMenu();
});