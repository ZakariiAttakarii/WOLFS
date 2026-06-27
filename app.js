document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('vibe-btn');
  const messageBox = document.getElementById('vibe-message');

  const messages = [
    "✨ You are officially vibe-coding on Google Cloud Run!",
    "🚀 Scaling down to zero is easy, but scaling up to your potential is key.",
    "🛡️ Completely serverless, robust, and zero-maintenance.",
    "💜 Built autonomously by Antigravity in just seconds.",
    "⚡ Fast response, hosted on high-performance Google infrastructure."
  ];

  btn.addEventListener('click', () => {
    // Pick a random message
    const randomIndex = Math.floor(Math.random() * messages.length);
    const message = messages[randomIndex];

    // Display the message box with the text
    messageBox.textContent = message;
    messageBox.classList.remove('hidden');

    // Add a simple button micro-interaction click effect
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      btn.style.transform = '';
    }, 100);
  });
});
