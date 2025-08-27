import React from 'react';

const Header = ({ onReset }) => (
  <>
    <div className="header">
      <button className="reset-btn" type="button" onClick={onReset}>Reset Form</button>
    </div>
    <div className="title-block">
      <h1 className="title">Dedicated CPA Quote Generator</h1>
      <div className="subtitle">Created by Ariel Keren, 2025</div>
    </div>
  </>
);

export default Header; 