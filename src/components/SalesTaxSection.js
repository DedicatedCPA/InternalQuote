import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import './SalesTaxSection.css';
import { calculateSalesTaxSetup, calculateSalesTaxRates } from '../calculators/monthlyCalculators';

const usStates = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const initialRow = {
  state: '',
  certificates: '',
  type: '',
  rate: '',
  setup: '',
};

const SalesTaxSection = forwardRef(({ setTotals, onAnyInputChange }, ref) => {
  const [rows, setRows] = useState([{ ...initialRow }]);
  const [errors, setErrors] = useState([{}]);

  const handleChange = (idx, field, value) => {
    setRows(rows =>
      rows.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
    
    // Clear error when user starts typing
    if (errors[idx] && errors[idx][field]) {
      setErrors(prev => 
        prev.map((err, i) => 
          i === idx ? { ...err, [field]: false } : err
        )
      );
    }
    
    if (onAnyInputChange) onAnyInputChange();
  };

  const handleAddRow = () => {
    setRows(rows => [...rows, { ...initialRow }]);
    setErrors(prev => [...prev, {}]);
    if (onAnyInputChange) onAnyInputChange();
  };

  const handleRemoveRow = (idx) => {
    setRows(rows => rows.filter((_, i) => i !== idx));
    setErrors(prev => prev.filter((_, i) => i !== idx));
    if (onAnyInputChange) onAnyInputChange();
  };

  // Validation function for a single row
  const validateRow = (row) => {
    const rowErrors = {};
    
    // State is required
    if (!row.state || row.state === '') {
      rowErrors.state = true;
    }
    
    // Certificates is required
    if (!row.certificates || row.certificates === '') {
      rowErrors.certificates = true;
    }
    
    // Type is required
    if (!row.type || row.type === '') {
      rowErrors.type = true;
    }
    
    return rowErrors;
  };

  // Function to validate all rows
  const validateAllRows = () => {
    const newErrors = rows.map(row => validateRow(row));
    setErrors(newErrors);
    return !newErrors.some(rowErrors => Object.values(rowErrors).some(error => error));
  };

  // Expose validation function to parent
  useImperativeHandle(ref, () => ({
    validate: validateAllRows,
    hasData: () => {
      // Check if any row has data (state, certificates, or type filled)
      return rows.some(row => 
        row.state || 
        row.certificates || 
        row.type
      );
    },
    getSalesTaxData: () => {
      // Return all rows with their data for popup generation
      return rows.filter(row => row.state && row.certificates && row.type).map(row => ({
        state: row.state,
        certificates: parseInt(row.certificates, 10) || 1,
        type: row.type
      }));
    }
  }));

  // Calculate all rates for the table
  const certRows = rows.map(row => row.certificates);
  const rates = calculateSalesTaxRates(certRows);
  // Calculate total rate and total setup for all rows
  const totalRate = rates.reduce((sum, r) => sum + (r ? Number(r) : 0), 0);
  const totalSetup = rows.reduce((sum, row) => {
    const s = calculateSalesTaxSetup(row.type, row.certificates);
    return sum + (s ? Number(s) : 0);
  }, 0);

  useEffect(() => {
    if (setTotals) {
      setTotals({ rate: totalRate, setup: totalSetup });
    }
  }, [totalRate, totalSetup, setTotals]);

  return (
    <div className="salestax-section-outer">
      <h2 className="dashboard-title salestax-title-centered">Sales Tax</h2>
      <div className="account-card salestax-card">
        <div className="salestax-header-row">
          <button className="salestax-add-btn" type="button" onClick={handleAddRow}>Add State</button>
        </div>
        <div className="salestax-transactions-table">
          <table>
            <thead>
              <tr>
                <th className="centered-header state-col">State</th>
                <th className="centered-header short-col"># of Certificates</th>
                <th className="centered-header type-col">Type</th>
                <th className="vertical-divider-col rate-col centered-header">Rate</th>
                <th className="setup-col centered-header">Set Up</th>
                <th className="vertical-divider-col actions-col centered-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                // Calculate Set Up fee
                const setupFee = calculateSalesTaxSetup(row.type, row.certificates);
                // Get the rate for this row
                const rate = rates[idx];
                return (
                  <tr key={idx}>
                    <td className="state-col">
                      <select className={`salestax-table-input account-input${errors[idx]?.state ? ' error' : ''}`} value={row.state} onChange={e => handleChange(idx, 'state', e.target.value)}>
                        <option value="">Select State</option>
                        {usStates.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </td>
                    <td className="short-col">
                      <input className={`salestax-table-input short${errors[idx]?.certificates ? ' error' : ''}`} type="number" min="0" value={row.certificates} onChange={e => handleChange(idx, 'certificates', e.target.value)} />
                    </td>
                    <td className="type-col">
                      <select className={`salestax-table-input account-input${errors[idx]?.type ? ' error' : ''}`} value={row.type} onChange={e => handleChange(idx, 'type', e.target.value)}>
                        <option value="">Select Type</option>
                        <option value="New">New</option>
                        <option value="Existing">Existing</option>
                      </select>
                    </td>
                    <td className="vertical-divider-col rate-col">{rate ? `$${rate}` : ''}</td>
                    <td className="setup-col">{setupFee ? `$${setupFee}` : ''}</td>
                    <td className="vertical-divider-col actions-col remove-cell">
                      {idx !== 0 ? (
                        <button
                          className="remove-row-btn"
                          type="button"
                          title="Remove Row"
                          onClick={() => handleRemoveRow(idx)}
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="salestax-totals-row">
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold' }}>Total:</td>
                <td className="vertical-divider-col rate-col" style={{ fontWeight: 'bold' }}>{totalRate ? `$${totalRate}` : ''}</td>
                <td className="setup-col" style={{ fontWeight: 'bold' }}>{totalSetup ? `$${totalSetup}` : ''}</td>
                <td className="vertical-divider-col actions-col"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
});

export default SalesTaxSection; 