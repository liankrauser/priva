// api/syncpay.js
// Endpoint seguro para gerenciar requisições da API do SyncPay no backend da Vercel

const SYNCPAY_CLIENT_ID = '331891e9-6e23-4af3-9d50-44235cc7e55e';
const SYNCPAY_CLIENT_SECRET = '232d4689-e85c-41b1-8b15-928424a62b81';
const API_URL = 'https://api.syncpayments.com.br';

module.exports = async (req, res) => {
    // Configura cabeçalhos de CORS caso seja chamado de desenvolvimento local
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // 1. Obter Token de Autenticação na SyncPay (Backend-to-Backend)
        const tokenResponse = await fetch(`${API_URL}/api/partner/v1/auth-token`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: SYNCPAY_CLIENT_ID,
                client_secret: SYNCPAY_CLIENT_SECRET
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Erro ao obter token SyncPay:', errorText);
            res.status(tokenResponse.status).json({
                error: 'Erro de autenticação na SyncPay',
                details: errorText
            });
            return;
        }

        const tokenData = await tokenResponse.json();
        const token = tokenData.access_token;

        // 2. Tratar requisições POST (Criar pagamento Pix)
        if (req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    res.status(400).json({ error: 'JSON de requisição inválido.' });
                    return;
                }
            }

            const { amount, description } = body || {};

            if (!amount) {
                res.status(400).json({ error: 'Parâmetro amount é obrigatório.' });
                return;
            }

            const cashInResponse = await fetch(`${API_URL}/api/partner/v1/cash-in`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    description: description || 'Assinatura'
                })
            });

            const cashInData = await cashInResponse.json();
            res.status(cashInResponse.status).json(cashInData);
            return;
        } 
        
        // 3. Tratar requisições GET (Consultar status da transação)
        else if (req.method === 'GET') {
            const { id } = req.query;

            if (!id) {
                res.status(400).json({ error: 'Parâmetro id (transaction identifier) é obrigatório.' });
                return;
            }

            const transactionResponse = await fetch(`${API_URL}/api/partner/v1/transaction/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            const transactionData = await transactionResponse.json();
            res.status(transactionResponse.status).json(transactionData);
            return;
        } 
        
        else {
            res.status(405).json({ error: 'Método não permitido.' });
        }
    } catch (error) {
        console.error('Erro na Vercel Serverless Function:', error);
        res.status(500).json({ error: 'Erro interno na Vercel Serverless Function.', details: error.message });
    }
};
