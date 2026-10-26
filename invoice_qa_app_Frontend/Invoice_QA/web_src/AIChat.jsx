import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { askQuestion, getChatHistory } from '../services/api';

export default function AIChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const invoiceId = location.state?.invoiceId;
  
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (invoiceId) {
      fetchHistory();
    }
  }, [invoiceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res = await getChatHistory(invoiceId);
      if (res.data.data && res.data.data.length > 0) {
        setMessages([
          { role: 'ai', content: 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay?' },
          ...res.data.data
        ]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || !invoiceId) {
      if (!invoiceId) alert('Vui lòng chọn một hóa đơn từ lịch sử để hỏi AI.');
      return;
    }
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await askQuestion(invoiceId, userMsg);
      setMessages(prev => [...prev, { role: 'ai', content: res.data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-helper-page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div className="history-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-icon" onClick={() => navigate(-1)}>←</button>
          <h2 style={{ fontSize: '20px', margin: 0 }}>Trợ lý Invoice AI</h2>
        </div>
      </div>
      
      {!invoiceId && (
        <div className="trash-warning" style={{ background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1E40AF' }}>
          ℹ️ Bạn chưa chọn hóa đơn nào. Vui lòng vào Lịch sử, chọn 1 hóa đơn để bắt đầu hỏi đáp.
        </div>
      )}

      <div style={{ 
        flex: 1, 
        background: 'var(--bg-card)', 
        borderRadius: 'var(--radius-md)', 
        border: '1px solid var(--border-light)', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '20px',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: msg.role === 'user' ? 'linear-gradient(135deg, #E879A8, #C084FC)' : 'var(--primary-bg)',
                color: msg.role === 'user' ? 'white' : 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', flexShrink: 0
              }}>
                {msg.role === 'user' ? 'U' : '✨'}
              </div>
              <div style={{
                background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-main)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                maxWidth: '75%',
                fontSize: '14px',
                lineHeight: 1.5
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--primary-bg)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
              }}>✨</div>
              <div style={{
                background: 'var(--bg-main)', padding: '12px 16px', borderRadius: 'var(--radius-md)',
                display: 'flex', gap: '4px', alignItems: 'center'
              }}>
                <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both' }}></div>
                <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
                <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSend} style={{ 
          padding: '16px', 
          borderTop: '1px solid var(--border)', 
          background: 'var(--bg-card)',
          display: 'flex', gap: '12px' 
        }}>
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={!invoiceId || loading}
            placeholder={invoiceId ? "Nhập câu hỏi của bạn..." : "Chọn hóa đơn để bắt đầu..."}
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              border: '1.5px solid var(--border)', 
              borderRadius: 'var(--radius-xl)',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: '14px'
            }} 
          />
          <button 
            type="submit" 
            disabled={!input.trim() || !invoiceId || loading}
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: input.trim() && invoiceId ? 'var(--primary)' : 'var(--bg-main)',
              color: input.trim() && invoiceId ? 'white' : 'var(--text-muted)',
              border: 'none', cursor: input.trim() && invoiceId ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
              transition: 'var(--transition)'
            }}
          >
            ➤
          </button>
        </form>
      </div>
      
      <style>{`
        @keyframes typing {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
