          /* WebSocket Localhost   */





  /* == 0) Connect to the real WebSocket server == */
  // Dynamically determine the protocol and host to connect to the server
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${location.host}/ws`;

  console.log(`Attempting to connect to WebSocket at: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  // Make the connection globally accessible for other scripts or debugging
  window.ws = ws;

  ws.onopen = () => {
    console.log('✅ WebSocket connection established.');
    // You could also update a UI element here to show "Connected"
  };

  ws.onclose = () => {
    console.log('❌ WebSocket connection closed.');
    // Here you might want to show a "Disconnected" message in the UI
  };

  ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
  };

  /* == 1) Click handling (delegation) - This part remains the same == */
  const root = document.querySelector('.battery-block');
  root?.addEventListener('click', (e) => {
    const btn = e.target.closest('button.toggle-btn, button.relay-btn');
    if (!btn) return;
    if (ws.readyState !== WebSocket.OPEN) { 
      alert('WebSocket is not connected yet'); 
      return; 
    }

    const block = btn.closest('.battery-button-block');
    const bank  = Number(block?.dataset.bank);
    const sw    = Number(block?.dataset.switch);
    const state = Number(btn.dataset.state); // 0/1/2...

    const payload = { type:'relay.set', bank, switch: sw, state };
    ws.send(JSON.stringify(payload));
    console.log('Sent:', payload);

    // Optional: local visual mark in the clicked group
    const group = btn.parentElement;
    group?.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  /* == 2) Incoming messages -> update UI - This part also remains the same == */
  ws.onmessage = (evt) => {
    let msg;
    try { 
      msg = JSON.parse(evt.data); 
      console.log('Received:', msg);
    } catch { 
      console.warn('Received non-JSON message:', evt.data);
      return; 
    }

    // a) relay.state: highlight proper button
    if (msg.type === 'relay.state') {
      const block = document.querySelector(`.battery-button-block[data-bank="${msg.bank}"][data-switch="${msg.switch}"]`);
      if (block) {
        const group = block.querySelector('.drawer-button-toggle, .drawer-button-relay');
        if (group) {
          group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          const btn = group.querySelector(`button[data-state="${msg.state}"]`);
          if (btn) btn.classList.add('active');
        }
      }
    }

    // b) relay.voltage: put volts into matching spans
    if (msg.type === 'relay.voltage') {
      document
        .querySelectorAll(`.display-value[data-bank="${msg.bank}"][data-stud="${msg.stud}"]`)
        .forEach(el => el.textContent = Number(msg.volts).toFixed(1));
    }
  };