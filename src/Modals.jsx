import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ============================================================================
// FIX #1: ASSIGN OWNERS MODAL
// ============================================================================
export function AssignOwnersButton() {
  const [showModal, setShowModal] = useState(false);
  const [selectedOwners, setSelectedOwners] = useState({});
  const orphanedTools = ['GitHub', 'Figma', 'Notion'];

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-white text-sm font-semibold transition-colors"
      >
        Assign Owners Now
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 rounded-3xl border border-white/10 p-8 max-w-lg w-full">
            <h3 className="text-2xl font-bold mb-4">Assign Tool Owners</h3>
            <p className="text-slate-300 mb-6">
              Assign owners to orphaned tools to improve accountability
            </p>
            <div className="space-y-4 mb-6">
              {orphanedTools.map(tool => (
                <div key={tool} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                  <span className="font-semibold text-white">{tool}</span>
                  <select 
                    value={selectedOwners[tool] || ''}
                    onChange={(e) => setSelectedOwners({...selectedOwners, [tool]: e.target.value})}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select owner...</option>
                    <option value="Sarah Chen">Sarah Chen (IT)</option>
                    <option value="Mike Johnson">Mike Johnson (Engineering)</option>
                    <option value="Emma Davis">Emma Davis (Design)</option>
                    <option value="David Kim">David Kim (Product)</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  alert('✅ Owners assigned successfully!');
                }}
                className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-semibold transition-colors"
              >
                Assign All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// FIX #2: VIEW ALL NAVIGATION BUTTON
// ============================================================================
export function ViewAllButton({ to, children = "View All →" }) {
  const navigate = useNavigate();
  
  return (
    <button 
      onClick={() => navigate(to)}
      className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors"
    >
      {children}
    </button>
  );
}

// ============================================================================
// FIX #3: HOW IT WORKS SCROLL BUTTON
// ============================================================================
export function HowItWorksButton({ children = "How It Works" }) {
  const scrollToHowItWorks = () => {
    const element = document.getElementById('how-it-works');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <button 
      onClick={scrollToHowItWorks}
      className="px-12 py-6 border-2 border-white/20 hover:border-white/30 bg-white/5 backdrop-blur-xl rounded-2xl font-semibold text-xl transition-all duration-300 hover:scale-105"
    >
      {children}
    </button>
  );
}

// ============================================================================
// FIX #4: INVOICE QUICK ACTIONS (Approve/Reject)
// ============================================================================
export function InvoiceQuickActions({ invoice, onAction }) {
  const handleApprove = () => {
    if (onAction) onAction('approve', invoice);
    alert(`✅ Invoice ${invoice.id} approved!`);
  };

  const handleReject = () => {
    const reason = prompt('Reason for rejection:');
    if (reason) {
      if (onAction) onAction('reject', invoice, reason);
      alert(`❌ Invoice ${invoice.id} rejected: ${reason}`);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleApprove}
        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-semibold transition-colors"
      >
        Approve
      </button>
      <button
        onClick={handleReject}
        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm font-semibold transition-colors"
      >
        Reject
      </button>
    </div>
  );
}
