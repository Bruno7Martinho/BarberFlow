// Sistema de gerenciamento de clientes

// Aguardar Firebase estar disponível
let clientsRef = null;
let currentClientId = null;
let auth = null;
let db = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeFirebaseAndClients();
});

// Inicializar Firebase primeiro, depois clientes
function initializeFirebaseAndClients() {
    console.log('Iniciando sistema de clientes...');
    
    // Verificar se Firebase está disponível
    if (typeof firebase === 'undefined') {
        console.log('Firebase não carregou ainda, aguardando...');
        setTimeout(initializeFirebaseAndClients, 500);
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
            console.log('Firebase inicializado no clientes.js');
        }
        
        // Obter referências
        auth = firebase.auth();
        db = firebase.firestore();
        clientsRef = db.collection("clients");
        
        console.log('Referências Firebase obtidas com sucesso!');
        
        // Agora sim inicializar sistema de clientes
        initializeClients();
        
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

// Inicializar sistema de clientes
function initializeClients() {
    if (!clientsRef) {
        console.error('clientsRef não disponível');
        showAlert('error', 'Erro na conexão com o banco de dados');
        return;
    }
    
    console.log('Inicializando sistema de clientes...');
    
    // Verificar se elementos existem
    const newClientBtn = document.getElementById('newClientBtn');
    const cancelFormBtn = document.getElementById('cancelFormBtn');
    const clientForm = document.getElementById('clientForm');
    
    if (!newClientBtn || !cancelFormBtn || !clientForm) {
        console.error('Elementos do formulário não encontrados!');
        return;
    }
    
    // Event Listeners
    newClientBtn.addEventListener('click', showClientForm);
    cancelFormBtn.addEventListener('click', hideClientForm);
    clientForm.addEventListener('submit', saveClient);
    
    const searchClient = document.getElementById('searchClient');
    if (searchClient) {
        searchClient.addEventListener('input', searchClients);
    }
    
    // Carregar clientes
    loadClients();
    
    // Verificar se veio de redirecionamento para novo cliente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
        showClientForm();
    }
    
    // Ano atual no rodapé
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
    
    console.log('Sistema de clientes inicializado com sucesso!');
}

// Mostrar formulário de cliente
function showClientForm() {
    const formContainer = document.getElementById('clientFormContainer');
    if (formContainer) {
        formContainer.classList.remove('hidden');
        currentClientId = null;
        
        // Limpar formulário
        const clientForm = document.getElementById('clientForm');
        if (clientForm) {
            clientForm.reset();
        }
        
        // Focar no primeiro campo
        const nameField = document.getElementById('clientName');
        if (nameField) {
            nameField.focus();
        }
        
        console.log('Formulário de cliente aberto');
    }
}

// Ocultar formulário de cliente
function hideClientForm() {
    const formContainer = document.getElementById('clientFormContainer');
    if (formContainer) {
        formContainer.classList.add('hidden');
        currentClientId = null;
        
        const clientForm = document.getElementById('clientForm');
        if (clientForm) {
            clientForm.reset();
        }
        
        console.log('Formulário de cliente fechado');
    }
}

// Carregar clientes do Firebase
async function loadClients() {
    if (!clientsRef) {
        console.error('Não é possível carregar clientes: clientsRef não definido');
        return;
    }
    
    try {
        console.log('Carregando clientes do Firebase...');
        const tableBody = document.querySelector('#clientsTable tbody');
        
        if (!tableBody) {
            console.error('Tabela de clientes não encontrada');
            return;
        }
        
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';
        
        // Buscar clientes do Firebase
        const snapshot = await clientsRef.orderBy('name').get();
        
        tableBody.innerHTML = '';
        
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum cliente cadastrado</td></tr>';
            console.log('Nenhum cliente encontrado no banco de dados');
            return;
        }
        
        console.log(`${snapshot.size} cliente(s) encontrado(s)`);
        
        snapshot.forEach(doc => {
            const client = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(client.name || '')}</td>
                <td>${escapeHtml(client.phone || 'Não informado')}</td>
                <td>${escapeHtml(client.email || 'Não informado')}</td>
                <td>${client.birthdate ? formatDate(client.birthdate) : 'Não informado'}</td>
                <td>${client.notes ? escapeHtml(client.notes.substring(0, 50) + (client.notes.length > 50 ? '...' : '')) : 'Sem observações'}</td>
                <td>
                    <button class="btn-action" onclick="editClient('${doc.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-danger" onclick="deleteClient('${doc.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        console.log('Clientes carregados com sucesso');
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        showAlert('error', 'Erro ao carregar clientes: ' + error.message);
        
        const tableBody = document.querySelector('#clientsTable tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Erro ao carregar dados. Tente recarregar a página.</td></tr>';
        }
    }
}

// Pesquisar clientes
function searchClients() {
    const searchTerm = document.getElementById('searchClient').value.toLowerCase();
    const rows = document.querySelectorAll('#clientsTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Salvar cliente
async function saveClient(e) {
    e.preventDefault();
    
    if (!clientsRef) {
        showAlert('error', 'Erro: Banco de dados não disponível');
        return;
    }
    
    try {
        // Coletar dados do formulário
        const clientData = {
            name: document.getElementById('clientName').value.trim(),
            phone: document.getElementById('clientPhone').value.trim(),
            email: document.getElementById('clientEmail').value.trim().toLowerCase(),
            birthdate: document.getElementById('clientBirthdate').value,
            notes: document.getElementById('clientNotes').value.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Adicionar usuário atual se disponível
        if (auth && auth.currentUser) {
            clientData.createdBy = auth.currentUser.email;
        }
        
        console.log('Salvando cliente:', clientData);
        
        // Validar dados
        if (!clientData.name) {
            showAlert('error', 'Nome é obrigatório');
            return;
        }
        
        if (currentClientId) {
            // Atualizar cliente existente
            console.log('Atualizando cliente ID:', currentClientId);
            await clientsRef.doc(currentClientId).update(clientData);
            showAlert('success', 'Cliente atualizado com sucesso!');
        } else {
            // Criar novo cliente
            console.log('Criando novo cliente...');
            await clientsRef.add(clientData);
            showAlert('success', 'Cliente cadastrado com sucesso!');
        }
        
        // Ocultar formulário e atualizar lista
        hideClientForm();
        loadClients();
        
    } catch (error) {
        console.error('Erro ao salvar cliente:', error);
        showAlert('error', 'Erro ao salvar cliente: ' + error.message);
    }
}

// Editar cliente
async function editClient(id) {
    if (!clientsRef) {
        showAlert('error', 'Banco de dados não disponível');
        return;
    }
    
    try {
        console.log('Editando cliente ID:', id);
        const doc = await clientsRef.doc(id).get();
        
        if (!doc.exists) {
            showAlert('error', 'Cliente não encontrado');
            return;
        }
        
        const client = doc.data();
        currentClientId = id;
        
        console.log('Dados do cliente para edição:', client);
        
        // Preencher formulário
        document.getElementById('clientName').value = client.name || '';
        document.getElementById('clientPhone').value = client.phone || '';
        document.getElementById('clientEmail').value = client.email || '';
        document.getElementById('clientBirthdate').value = client.birthdate || '';
        document.getElementById('clientNotes').value = client.notes || '';
        
        // Mostrar formulário
        const formContainer = document.getElementById('clientFormContainer');
        if (formContainer) {
            formContainer.classList.remove('hidden');
        }
        
        // Rolar até o formulário
        formContainer.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Erro ao carregar cliente:', error);
        showAlert('error', 'Erro ao carregar cliente: ' + error.message);
    }
}

// Excluir cliente
async function deleteClient(id) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) {
        return;
    }
    
    if (!clientsRef) {
        showAlert('error', 'Banco de dados não disponível');
        return;
    }
    
    try {
        // Verificar se cliente tem agendamentos
        const appointmentsRef = db.collection("appointments");
        const appointmentsSnapshot = await appointmentsRef
            .where('clientId', '==', id)
            .get();
        
        if (!appointmentsSnapshot.empty) {
            if (!confirm('Este cliente tem agendamentos. Deseja excluir mesmo assim?')) {
                return;
            }
        }
        
        console.log('Excluindo cliente ID:', id);
        await clientsRef.doc(id).delete();
        showAlert('success', 'Cliente excluído com sucesso!');
        loadClients();
        
    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        showAlert('error', 'Erro ao excluir cliente: ' + error.message);
    }
}

// Formatar data
function formatDate(dateString) {
    if (!dateString) return 'Data inválida';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return 'Data inválida';
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
        document.querySelector('.main-content').prepend(newAlert);
    }
    
    const alertElement = document.getElementById('alertMessage');
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
window.editClient = editClient;
window.deleteClient = deleteClient;
window.logout = logout;

console.log('Módulo de clientes carregado');