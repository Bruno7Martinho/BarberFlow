// menu.js
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const menuOverlay = document.getElementById('menuOverlay');
    const navbar = document.querySelector('.navbar');
    
    if (menuToggle && navbar) {
        console.log('✅ Menu hambúrguer inicializado');
        
        menuToggle.addEventListener('click', function() {
            console.log('Hambúrguer clicado');
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
        
        // Fechar menu ao redimensionar para desktop
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                navbar.classList.remove('active');
                if (menuOverlay) {
                    menuOverlay.classList.remove('active');
                }
            }
        });
    } else {
        console.log('❌ Elementos do menu não encontrados');
    }
});