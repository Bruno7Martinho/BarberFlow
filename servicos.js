// Sistema de gerenciamento de serviços

// Variáveis globais
let servicesRef = null;
let currentServiceId = null;
let auth = null;
let db = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeFirebaseAndServices();
});

// Inicializar Firebase primeiro, depois serviços
function initializeFirebaseAndServices() {
    console.log('Iniciando sistema de serviços...');
    
    // Verificar se Firebase está disponível
    if (typeof firebase === 'undefined') {
        console.log('Firebase não carregou ainda, aguardando...');
        setTimeout(initializeFirebaseAndServices, 500);
        return;
    }
    
    try {
        // Configuração do Firebase (caso não tenha sido inicializado)
        const firebaseConfig = {
            apiKey: "AIzaSyDIqJpw0EnBnkZWvXIbMQIxai394lsqAKA",
            authDomain: "barbearia-84d78.firebaseapp.com",
            projectId: "barbearia-84d78",
            storageBucket: "barbearia-84d78.firebasestorage.app",
            messagingSenderId: "42251761510",
            appId: "1:42251761510:web:03e036a25931a461c43aa7"
        };
        
        // Inicializar Firebase se não estiver inicializado
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase inicializado no servicos.js');
        }
        
        // Obter referências
        auth = firebase.auth();
        db = firebase.firestore();
        servicesRef = db.collection("services");
        
        console.log('Referências Firebase obtidas com sucesso!', { servicesRef: !!servicesRef });
        
        // Agora sim inicializar sistema de serviços
        initializeServices();
        
        // Verificar autenticação
        auth.onAuthStateChanged(user => {
            if (!user) {
                window.location.href = 'login.html';
            } else {
                console.log('Usuário autenticado:', user.email);
                // Atualizar nome do usuário
                const userNameElement = document.getElementById('userName');
                if (userNameElement) {
                    userNameElement.textContent = user.email;
                }
            }
        });
        
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        showAlert('error', 'Erro ao conectar com o banco de dados');
    }
}

// Inicializar sistema de serviços
function initializeServices() {
    if (!servicesRef) {
        console.error('servicesRef não disponível');
        showAlert('error', 'Erro na conexão com o banco de dados');
        return;
    }
    
    console.log('Inicializando sistema de serviços...');
    
    // Verificar se elementos existem
    const newServiceBtn = document.getElementById('newServiceBtn');
    const cancelFormBtn = document.getElementById('cancelFormBtn');
    const serviceForm = document.getElementById('serviceForm');
    
    if (!newServiceBtn || !cancelFormBtn || !serviceForm) {
        console.error('Elementos do formulário não encontrados!');
        return;
    }
    
    // Event Listeners
    newServiceBtn.addEventListener('click', showServiceForm);
    cancelFormBtn.addEventListener('click', hideServiceForm);
    serviceForm.addEventListener('submit', saveService);
    
    const searchService = document.getElementById('searchService');
    if (searchService) {
        searchService.addEventListener('input', searchServices);
    }
    
    // Carregar serviços
    loadServices();
    
    // Verificar se veio de redirecionamento para novo serviço
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
        showServiceForm();
    }
    
    // Ano atual no rodapé
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
    
    console.log('Sistema de serviços inicializado com sucesso!');
}

// Mostrar formulário de serviço
function showServiceForm() {
    const formContainer = document.getElementById('serviceFormContainer');
    if (formContainer) {
        formContainer.classList.remove('hidden');
        currentServiceId = null;
        
        // Limpar formulário
        const serviceForm = document.getElementById('serviceForm');
        if (serviceForm) {
            serviceForm.reset();
            document.getElementById('serviceActive').checked = true;
        }
        
        // Focar no primeiro campo
        const nameField = document.getElementById('serviceName');
        if (nameField) {
            nameField.focus();
        }
        
        console.log('Formulário de serviço aberto');
    }
}

// Ocultar formulário de serviço
function hideServiceForm() {
    const formContainer = document.getElementById('serviceFormContainer');
    if (formContainer) {
        formContainer.classList.add('hidden');
        currentServiceId = null;
        
        const serviceForm = document.getElementById('serviceForm');
        if (serviceForm) {
            serviceForm.reset();
        }
        
        console.log('Formulário de serviço fechado');
    }
}

// Carregar serviços do Firebase
async function loadServices() {
    if (!servicesRef) {
        console.error('Não é possível carregar serviços: servicesRef não definido');
        return;
    }
    
    try {
        console.log('Carregando serviços do Firebase...');
        const tableBody = document.querySelector('#servicesTable tbody');
        
        if (!tableBody) {
            console.error('Tabela de serviços não encontrada');
            return;
        }
        
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Carregando...</td></tr>';
        
        // Buscar serviços do Firebase
        const snapshot = await servicesRef.orderBy('name').get();
        
        tableBody.innerHTML = '';
        
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum serviço cadastrado</td></tr>';
            console.log('Nenhum serviço encontrado no banco de dados');
            return;
        }
        
        console.log(`${snapshot.size} serviço(s) encontrado(s)`);
        
        snapshot.forEach(doc => {
            const service = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(service.name || '')}</td>
                <td>${escapeHtml(service.description || 'Sem descrição')}</td>
                <td>R$ ${service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'}</td>
                <td>${service.duration || 0} min</td>
                <td>${escapeHtml(service.category || 'Geral')}</td>
                <td><span class="status-badge ${service.active !== false ? 'confirmed' : 'canceled'}">${service.active !== false ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                    <button class="btn-action" onclick="editService('${doc.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-danger" onclick="deleteService('${doc.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        console.log('Serviços carregados com sucesso');
        
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        showAlert('error', 'Erro ao carregar serviços: ' + error.message);
        
        const tableBody = document.querySelector('#servicesTable tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Erro ao carregar dados. Tente recarregar a página.</td></tr>';
        }
    }
}

// Pesquisar serviços
function searchServices() {
    const searchTerm = document.getElementById('searchService').value.toLowerCase();
    const rows = document.querySelectorAll('#servicesTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Salvar serviço
async function saveService(e) {
    e.preventDefault();
    
    if (!servicesRef) {
        showAlert('error', 'Erro: Banco de dados não disponível');
        console.error('servicesRef não definido ao salvar');
        return;
    }
    
    try {
        // Coletar dados do formulário
        const serviceData = {
            name: document.getElementById('serviceName').value.trim(),
            description: document.getElementById('serviceDescription').value.trim(),
            price: parseFloat(document.getElementById('servicePrice').value.replace(',', '.')),
            duration: parseInt(document.getElementById('serviceDuration').value),
            category: document.getElementById('serviceCategory').value,
            active: document.getElementById('serviceActive').checked,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Adicionar usuário atual se disponível
        if (auth && auth.currentUser) {
            serviceData.createdBy = auth.currentUser.email;
        }
        
        console.log('Salvando serviço:', serviceData);
        
        // Validar dados
        if (!serviceData.name) {
            showAlert('error', 'Nome do serviço é obrigatório');
            return;
        }
        
        if (isNaN(serviceData.price) || serviceData.price <= 0) {
            showAlert('error', 'Preço deve ser um número maior que zero');
            return;
        }
        
        if (isNaN(serviceData.duration) || serviceData.duration < 5) {
            showAlert('error', 'Duração mínima é de 5 minutos');
            return;
        }
        
        if (currentServiceId) {
            // Atualizar serviço existente
            console.log('Atualizando serviço ID:', currentServiceId);
            await servicesRef.doc(currentServiceId).update(serviceData);
            showAlert('success', 'Serviço atualizado com sucesso!');
        } else {
            // Criar novo serviço
            console.log('Criando novo serviço...');
            await servicesRef.add(serviceData);
            showAlert('success', 'Serviço cadastrado com sucesso!');
        }
        
        // Ocultar formulário e atualizar lista
        hideServiceForm();
        loadServices();
        
    } catch (error) {
        console.error('Erro ao salvar serviço:', error);
        showAlert('error', 'Erro ao salvar serviço: ' + error.message);
    }
}

// Editar serviço
async function editService(id) {
    if (!servicesRef) {
        showAlert('error', 'Banco de dados não disponível');
        return;
    }
    
    try {
        console.log('Editando serviço ID:', id);
        const doc = await servicesRef.doc(id).get();
        
        if (!doc.exists) {
            showAlert('error', 'Serviço não encontrado');
            return;
        }
        
        const service = doc.data();
        currentServiceId = id;
        
        console.log('Dados do serviço para edição:', service);
        
        // Preencher formulário
        document.getElementById('serviceName').value = service.name || '';
        document.getElementById('serviceDescription').value = service.description || '';
        document.getElementById('servicePrice').value = service.price || '';
        document.getElementById('serviceDuration').value = service.duration || 30;
        document.getElementById('serviceCategory').value = service.category || 'Corte';
        document.getElementById('serviceActive').checked = service.active !== false;
        
        // Mostrar formulário
        const formContainer = document.getElementById('serviceFormContainer');
        if (formContainer) {
            formContainer.classList.remove('hidden');
        }
        
        // Rolar até o formulário
        formContainer.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Erro ao carregar serviço:', error);
        showAlert('error', 'Erro ao carregar serviço: ' + error.message);
    }
}

// Excluir serviço
async function deleteService(id) {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) {
        return;
    }
    
    if (!servicesRef) {
        showAlert('error', 'Banco de dados não disponível');
        return;
    }
    
    try {
        // Verificar se serviço está em uso em agendamentos
        const appointmentsRef = db.collection("appointments");
        const appointmentsSnapshot = await appointmentsRef
            .where('serviceId', '==', id)
            .get();
        
        if (!appointmentsSnapshot.empty) {
            if (!confirm('Este serviço está sendo usado em agendamentos. Deseja excluir mesmo assim?')) {
                return;
            }
        }
        
        console.log('Excluindo serviço ID:', id);
        await servicesRef.doc(id).delete();
        showAlert('success', 'Serviço excluído com sucesso!');
        loadServices();
        
    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        showAlert('error', 'Erro ao excluir serviço: ' + error.message);
    }
}

// Escapar HTML para segurança
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Exibir alertas
function showAlert(type, message) {
    const alertDiv = document.getElementById('alertMessage');
    if (!alertDiv) {
        // Criar elemento de alerta se não existir
        const newAlert = document.createElement('div');
        newAlert.id = 'alertMessage';
        newAlert.className = 'alert';
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.prepend(newAlert);
        }
    }
    
    const alertElement = document.getElementById('alertMessage');
    if (!alertElement) return;
    
    alertElement.textContent = message;
    alertElement.className = 'alert';
    
    if (type === 'success') {
        alertElement.classList.add('alert-success');
    } else if (type === 'error') {
        alertElement.classList.add('alert-error');
    } else {
        alertElement.classList.add('alert-info');
    }
    
    alertElement.classList.remove('hidden');
    
    // Ocultar alerta após 5 segundos
    setTimeout(() => {
        alertElement.classList.add('hidden');
    }, 5000);
}

// Função logout global
function logout() {
    if (auth) {
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Erro no logout:', error);
        });
    } else {
        window.location.href = 'login.html';
    }
}

// Exportar funções para uso global
window.editService = editService;
window.deleteService = deleteService;
window.logout = logout;

console.log('Módulo de serviços carregado');