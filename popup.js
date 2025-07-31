document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleButton');
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');
    const adStatus = document.getElementById('adStatus');
    const currentSpeed = document.getElementById('currentSpeed');
    
    let isEnabled = true;
    
    // Get current status
    function updateStatus() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, function(response) {
                    if (chrome.runtime.lastError) {
                        // Extension not loaded on this tab
                        statusText.textContent = 'Inactive';
                        statusIndicator.className = 'indicator inactive';
                        adStatus.textContent = 'Not on YouTube';
                        currentSpeed.textContent = '1x';
                        toggleButton.textContent = 'Extension Not Active';
                        toggleButton.className = 'toggle-button disabled';
                        return;
                    }
                    
                    if (response) {
                        isEnabled = response.enabled;
                        
                        // Update status
                        statusText.textContent = isEnabled ? 'Active' : 'Disabled';
                        statusIndicator.className = isEnabled ? 'indicator active' : 'indicator inactive';
                        
                        // Update ad detection status
                        adStatus.textContent = response.adDetected ? 'Ad Detected (10x)' : 'No Ad';
                        
                        // Update current speed
                        currentSpeed.textContent = response.currentSpeed + 'x';
                        
                        // Update button
                        toggleButton.textContent = isEnabled ? 'Disable Extension' : 'Enable Extension';
                        toggleButton.className = 'toggle-button';
                    }
                });
            } else {
                statusText.textContent = 'Not on YouTube';
                statusIndicator.className = 'indicator inactive';
                adStatus.textContent = 'Visit YouTube';
                currentSpeed.textContent = '1x';
                toggleButton.textContent = 'Visit YouTube';
                toggleButton.className = 'toggle-button disabled';
            }
        });
    }
    
    // Toggle extension
    toggleButton.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                const newStatus = !isEnabled;
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleExtension',
                    enabled: newStatus
                }, function(response) {
                    if (response && response.success) {
                        isEnabled = newStatus;
                        updateStatus();
                    }
                });
            }
        });
    });
    
    // Initial status update
    updateStatus();
    
    // Update status every 2 seconds
    setInterval(updateStatus, 2000);
});