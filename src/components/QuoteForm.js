import React, { useState, forwardRef, useImperativeHandle } from 'react';

const QuoteForm = forwardRef(({ onAnyInputChange }, ref) => {
  const [formData, setFormData] = useState({
    companyName: '',
    ownerName: '',
    employee: ''
  });

  const [errors, setErrors] = useState({
    companyName: false,
    ownerName: false,
    employee: false
  });

  const LEGAL_ENTITY_SUFFIXES = [
    'llc', 'inc', 'corp', 'co', 'ltd', 'llp', 'pllc', 'plc', 'inc.', 'corp.', 'co.', 'ltd.', 'llp.', 'pllc.', 'plc.', 'company', 'corporation', 'limited', 'incorporated', 'gmbh', 'sarl', 'sa', 'pte', 'pty', 'ag', 'bv', 'kg', 'kgaa', 'oy', 'ab', 'aps', 'as', 'nv', 'srl', 'spa', 'srl.', 's.p.a.', 's.a.', 's.a.s.', 's.n.c.', 's.c.p.a.', 's.c.a.r.l.', 's.c.r.l.', 's.c.s.', 's.c.a.', 's.c.s.a.', 's.c.s.p.', 's.c.s.s.', 's.c.s.s.p.', 's.c.s.s.a.', 's.c.s.s.p.a.', 's.c.s.s.p.s.', 's.c.s.s.p.s.a.', 's.c.s.s.p.s.p.', 's.c.s.s.p.s.p.a.', 's.c.s.s.p.s.p.s.', 's.c.s.s.p.s.p.s.a.', 's.c.s.s.p.s.p.s.p.', 's.c.s.s.p.s.p.s.p.a.'
  ];

  function hasLegalEntitySuffix(name) {
    if (!name) return false;
    const lower = name.trim().toLowerCase();
    return LEGAL_ENTITY_SUFFIXES.some(suffix => lower.endsWith(' ' + suffix) || lower.endsWith('.' + suffix) || lower.endsWith(suffix));
  }

  // Format company name with proper capitalization
  function formatCompanyName(name) {
    if (!name) return '';
    
    // Split the name into words
    const words = name.trim().split(/\s+/);
    
    return words.map((word, index) => {
      // Handle empty words
      if (!word) return word;
      
      // Check if this word is a legal entity suffix
      const isSuffix = LEGAL_ENTITY_SUFFIXES.some(suffix => 
        word.toLowerCase() === suffix.toLowerCase()
      );
      
      if (isSuffix) {
        // Special handling for LLC - capitalize all letters
        if (word.toLowerCase() === 'llc') {
          return 'LLC';
        }
        // For other suffixes, capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      } else {
        // For regular words, capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
    }).join(' ');
  }

  // Format owner's name with proper capitalization (first letter of each word)
  function formatOwnerName(name) {
    if (!name) return '';
    
    return name.trim().split(/\s+/).map(word => {
      // Handle empty words
      if (!word) return word;
      
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }

  const handleInputChange = (field, value) => {
    // Don't apply formatting during typing - just store the raw value
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
    
    if (onAnyInputChange) onAnyInputChange();
  };

  const handleInputBlur = (field, value) => {
    let formattedValue = value;
    
    // Apply formatting when user finishes typing (on blur)
    if (field === 'companyName') {
      formattedValue = formatCompanyName(value);
    } else if (field === 'ownerName') {
      formattedValue = formatOwnerName(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    
    if (onAnyInputChange) onAnyInputChange();
  };

  // Validation function
  const validateField = (field, value) => {
    if (field === 'employee') {
      return value !== '' && value !== undefined;
    }
    if (field === 'companyName') {
      return value.trim() !== '' && hasLegalEntitySuffix(value);
    }
    return value.trim() !== '';
  };

  // Function to validate all fields
  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(field => {
      newErrors[field] = !validateField(field, formData[field]);
    });
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  // Expose validation function and data to parent
  useImperativeHandle(ref, () => ({
    validate: validateForm,
    getFormData: () => formData
  }));

  return (
    <form className="quote-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="companyName">Company Name:</label>
          <input 
            type="text" 
            id="companyName" 
            name="companyName" 
            placeholder="Company Name" 
            value={formData.companyName}
            onChange={e => handleInputChange('companyName', e.target.value)}
            onBlur={e => handleInputBlur('companyName', e.target.value)}
            className={`company-input${errors.companyName ? ' error' : ''}`}
          />
        </div>
        <div className="form-group">
          <label htmlFor="ownerName">Owner's Name:</label>
          <input 
            type="text" 
            id="ownerName" 
            name="ownerName" 
            placeholder="Owner's Name" 
            value={formData.ownerName}
            onChange={e => handleInputChange('ownerName', e.target.value)}
            onBlur={e => handleInputBlur('ownerName', e.target.value)}
            className={`owner-input${errors.ownerName ? ' error' : ''}`}
          />
        </div>
        <div className="form-group">
          <label htmlFor="employee">Employee:</label>
          <select 
            id="employee" 
            name="employee" 
            value={formData.employee}
            onChange={e => handleInputChange('employee', e.target.value)}
            className={`employee-input${errors.employee ? ' error' : ''}`}
          >
            <option value="">Select…</option>
            <option value="Alexia White">Alexia White</option>
            <option value="Amit Ben-Natan">Amit Ben-Natan</option>
            <option value="Ariel Keren">Ariel Keren</option>
            <option value="Eran Moshe">Eran Moshe</option>
            <option value="Martha Orejuela">Martha Orejuela</option>
            <option value="Noa Hen">Noa Hen</option>
            <option value="Omer Belzer">Omer Belzer</option>
            <option value="Shay Keren">Shay Keren</option>
          </select>
        </div>
      </div>
    </form>
  );
});

export default QuoteForm; 