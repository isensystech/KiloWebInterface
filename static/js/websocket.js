/* WebSocket Localhost */

/* == 0) Connect to the real WebSocket server == */
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${location.host}/ws`;

console.log(`Attempting to connect to WebSocket at: ${wsUrl}`);
const ws = new WebSocket(wsUrl);

// Make the connection globally accessible
window.ws = ws;

ws.onopen = () => {
  console.log('✅ WebSocket connection established.');
};

ws.onclose = () => {
  console.log('❌ WebSocket connection closed.');
};

ws.onerror = (error) => {
  console.error('WebSocket Error:', error);
};

/* == 2) Incoming messages -> update UI == */
ws.onmessage = (evt) => {
  let msg;
  try {
    msg = JSON.parse(evt.data);
    console.log('Received:', msg);
  } catch {
    console.warn('Received non-JSON message:', evt.data);
    return;
  }

  // a) EGIS relay.state
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

  // b) EGIS relay.voltage
  else if (msg.type === 'relay.voltage') {
    document
      .querySelectorAll(`.display-value[data-bank="${msg.bank}"][data-stud="${msg.stud}"]`)
      .forEach(el => el.textContent = Number(msg.volts).toFixed(1));
  }
  
  // c) M20 Relay Feedback
  else if (msg.type === 'm20relay.state') {
    const componentBlock = document.querySelector(`[data-component="m20relay"][data-switch="${msg.switch}"]`);
    if (componentBlock) {
      componentBlock.querySelectorAll('button[data-state]').forEach(b => b.classList.remove('active'));
      const activeButton = componentBlock.querySelector(`button[data-state="${msg.state}"]`);
      if (activeButton) {
        activeButton.classList.add('active');
      }
    }
  }
  
  // d) AIS Status Feedback
  else if (msg.type === 'fb.ais') {
      const aisBlock = document.querySelector('#ais-controls');
      if (aisBlock) {
          aisBlock.querySelectorAll('button[data-action]').forEach(b => b.classList.remove('active'));
          const activeButton = aisBlock.querySelector(`button[data-action="${msg.value}"]`);
          if (activeButton) {
              activeButton.classList.add('active');
          }
      }
  }
};