// content.js - Simplified Ad Detection (Focus on player class)
// This script runs on YouTube pages to detect and speed up ads.

(function() {
    'use strict';

    // --- Global State Variables ---
    let isEnabled = true;
    let isAdActive = false;
    let originalSpeed = 1;
    let video = null;

    // --- Interval and Observer References for Cleanup ---
    let detectionInterval = null;
    let adMutationObserver = null;
    let navigationObserver = null;
    let speedApplicationInterval = null;

    // --- Helper: isElementTrulyVisible() Function (Still present for robustness, but less critical now) ---
    // (This function's usage is significantly reduced in hasAd() now)
    function isElementTrulyVisible(element) {
        if (!element || element.nodeType !== 1) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (parseFloat(style.opacity) === 0) return false;

        if (element.offsetWidth === 0 && element.offsetHeight === 0) {
            return false;
        }
        
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) {
             return false;
        }
        
        let current = element;
        while (current && current !== document.body) {
            const parentStyle = window.getComputedStyle(current);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parseFloat(parentStyle.opacity) === 0) {
                return false;
            }
            current = current.parentElement;
        }

        return true;
    }


    // --- 1. hasAd() Function: Detects if an ad is currently playing (SIMPLIFIED) ---
    function hasAd() {
        console.log('hasAd(): Checking for ads using player container classes.');

        const playerContainer = document.querySelector('#movie_player');
        if (playerContainer) {
            const classList = playerContainer.className;
            if (classList.includes('ad-showing') || classList.includes('ad-interrupting')) {
                console.log('hasAd(): AD DETECTED via player container class:', classList);
                return true;
            }
        }

        console.log('hasAd(): No ad detected via player container classes.');
        return false;
    }

    // --- Helper: findVideo() Function ---
    function findVideo() {
        // console.log('findVideo(): Attempting to find video element.');
        if (video && document.contains(video) && video.readyState >= 1) {
            return video;
        }

        const playerContainer = document.querySelector('#movie_player');
        let mainVideoCandidate = null;

        if (playerContainer) {
            mainVideoCandidate = playerContainer.querySelector('video');
        }

        if (mainVideoCandidate && mainVideoCandidate.readyState >= 1) {
            video = mainVideoCandidate;
            // console.log('findVideo(): Found video within #movie_player:', video);
            return video;
        }

        const allVideos = document.querySelectorAll('video');
        for (const v of allVideos) {
            if ((v.duration > 0 || !v.paused || v.currentTime > 0) && v.readyState >= 1) {
                video = v;
                // console.log('findVideo(): Found video via general search (fallback):', video);
                return video;
            }
        }

        video = null;
        // console.warn('findVideo(): No active video element found on the page.');
        return null;
    }

    // --- Speed Control ---
    function setVideoSpeed(targetSpeed) {
        console.log(`setVideoSpeed(): Attempting to set speed to ${targetSpeed}x.`);
        const v = findVideo();
        if (!v) {
            console.warn('setVideoSpeed(): Cannot set video speed: No video element found.');
            return false;
        }

        if (typeof targetSpeed !== 'number' || isNaN(targetSpeed) || targetSpeed <= 0) {
            console.error('setVideoSpeed(): Invalid target speed:', targetSpeed);
            return false;
        }

        if (speedApplicationInterval) {
            clearInterval(speedApplicationInterval);
            speedApplicationInterval = null;
        }

        try {
            if (!isAdActive && Math.abs(v.playbackRate - targetSpeed) > 0.1) {
                originalSpeed = v.playbackRate;
                console.log(`setVideoSpeed(): Stored original speed: ${originalSpeed}x.`);
            }

            let attempts = 0;
            const maxAttempts = 20;

            const applySpeed = () => {
                if (!v || !document.contains(v)) {
                    clearInterval(speedApplicationInterval);
                    speedApplicationInterval = null;
                    console.warn('setVideoSpeed(): Video element disappeared during speed application, stopping attempts.');
                    return;
                }

                if (Math.abs(v.playbackRate - targetSpeed) > 0.05) {
                    v.playbackRate = targetSpeed;
                } else {
                    clearInterval(speedApplicationInterval);
                    speedApplicationInterval = null;
                    console.log(`setVideoSpeed(): Speed successfully set and stable at ${targetSpeed}x.`);
                    return;
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    clearInterval(speedApplicationInterval);
                    speedApplicationInterval = null;
                    console.warn(`setVideoSpeed(): Failed to stabilize speed at ${targetSpeed}x after ${maxAttempts} attempts. Video playbackRate is ${v.playbackRate}x`);
                }
            };

            applySpeed();
            if (Math.abs(v.playbackRate - targetSpeed) > 0.05) {
                speedApplicationInterval = setInterval(applySpeed, 50);
            }

            console.log(`setVideoSpeed(): Requested video speed change to ${targetSpeed}x.`);
            return true;
        } catch (error) {
            console.error('setVideoSpeed(): Error setting video speed:', error);
            if (speedApplicationInterval) {
                clearInterval(speedApplicationInterval);
                speedApplicationInterval = null;
            }
            return false;
        }
    }

    function getMaxSupportedSpeed() {
        console.log('getMaxSupportedSpeed(): Determining max supported speed.');
        return 16;
    }

    // --- Main Logic: Reacting to Ad State Changes ---
    function processAdState() {
        console.log('processAdState(): Checking current ad state.');
        if (!isEnabled) {
            console.log('processAdState(): Extension is disabled. Skipping check.');
            return;
        }

        const adCurrentlyDetected = hasAd();

        if (adCurrentlyDetected !== isAdActive) {
            isAdActive = adCurrentlyDetected;

            if (isAdActive) {
                console.log('🚀 AD DETECTED - Transitioning to ad state.');
                
                const currentVideoRef = findVideo();
                if (currentVideoRef) {
                    if (Math.abs(currentVideoRef.playbackRate - getMaxSupportedSpeed()) > 0.1) {
                         originalSpeed = currentVideoRef.playbackRate;
                    }
                    console.log(`processAdState(): Captured original speed for restoration: ${originalSpeed}x.`);
                } else {
                    console.warn('processAdState(): Could not find video element to capture original speed when ad detected.');
                }
                
                setVideoSpeed(getMaxSupportedSpeed());
                showBriefNotification(`Ad detected - ${getMaxSupportedSpeed()}x speed`, 'speedup');
            } else {
                console.log('✅ AD ENDED - Transitioning to normal state.');
                setVideoSpeed(originalSpeed);
                showBriefNotification('Normal speed restored', 'restore');
            }
        } else {
            // Re-apply speed if ad is active but speed is not max
            if (isAdActive) {
                const v = findVideo();
                if (v && Math.abs(v.playbackRate - getMaxSupportedSpeed()) > 0.1) {
                    console.log('processAdState(): Ad still active but speed not max. Re-applying max speed.');
                    setVideoSpeed(getMaxSupportedSpeed());
                }
            }
            // Re-apply original speed if no ad active but speed is not original
            else if (!isAdActive) {
                const v = findVideo();
                if (v && Math.abs(v.playbackRate - originalSpeed) > 0.1) {
                    console.log('processAdState(): No ad, but speed not original. Re-applying original speed.');
                    setVideoSpeed(originalSpeed);
                }
            }
        }
    }

    // --- Minimal Notification System ---
    function showBriefNotification(message, type) {
        console.log(`showBriefNotification(): Displaying notification: "${message}" (${type}).`);
        if (!document.body) {
            console.warn('showBriefNotification(): Document body not found, cannot display notification.');
            return;
        }

        const existing = document.getElementById('speed-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.id = 'speed-notification';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 2147483647;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            color: white;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            ${type === 'speedup' ? 'background: #DC3545;' : 'background: #28A745;'}
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '1';
        }, 50);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, 2500);
    }

    // --- Monitoring & Cleanup Functions ---
    function disconnectAllMonitoring() {
        console.log('disconnectAllMonitoring(): Disconnecting all observers and clearing intervals.');
        if (adMutationObserver) {
            adMutationObserver.disconnect();
            adMutationObserver = null;
            console.log('disconnectAllMonitoring(): Ad MutationObserver disconnected.');
        }
        if (navigationObserver) {
            navigationObserver.disconnect();
            navigationObserver = null;
            console.log('disconnectAllMonitoring(): Navigation Observer disconnected.');
        }
        if (detectionInterval) {
            clearInterval(detectionInterval);
            detectionInterval = null;
            console.log('disconnectAllMonitoring(): Periodic check timer cleared.');
        }
        if (speedApplicationInterval) {
            clearInterval(speedApplicationInterval);
            speedApplicationInterval = null;
            console.log('disconnectAllMonitoring(): Speed application interval cleared.');
        }
    }

    function startMonitoring() {
        console.log('startMonitoring(): Starting all monitoring components.');
        disconnectAllMonitoring();

        // Reduced interval for faster checking, as hasAd() is now very lightweight
        detectionInterval = setInterval(() => {
            if (isEnabled) {
                processAdState();
            }
        }, 250); // Checking every 250 milliseconds
        console.log('startMonitoring(): Periodic ad check interval started (250ms).');

        const playerContainer = document.querySelector('#movie_player');
        if (playerContainer) {
            adMutationObserver = new MutationObserver(mutations => {
                let relevantChange = false;
                for (let mutation of mutations) {
                    // We only need to trigger processAdState if attributes (like class) change on the player container
                    // or if new children are added/removed (less critical if relying solely on player class)
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        relevantChange = true;
                        break;
                    }
                    // Consider childList too, in case ad overlays are direct children, but player class is primary.
                    if (mutation.type === 'childList') {
                        relevantChange = true;
                        break;
                    }
                }
                if (relevantChange && isEnabled) {
                    console.log('startMonitoring(): MutationObserver detected relevant change, processing ad state.');
                    processAdState();
                }
            });
            adMutationObserver.observe(playerContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
            console.log('startMonitoring(): Ad MutationObserver started on #movie_player.');
        } else {
            console.warn('startMonitoring(): Could not find #movie_player for Ad MutationObserver. Ad detection might be less responsive.');
        }

        const titleElement = document.querySelector('title');
        if (titleElement) {
            navigationObserver = new MutationObserver(() => {
                if (location.href !== navigationObserver._currentUrl) {
                    navigationObserver._currentUrl = location.href;
                    console.log('startMonitoring(): 📍 Page navigation detected (SPA), reinitializing content script...');
                    isAdActive = false;
                    video = null;
                    originalSpeed = 1;
                    setTimeout(initialize, 500);
                }
            });
            navigationObserver._currentUrl = location.href;
            navigationObserver.observe(titleElement, { childList: true, characterData: true });
            console.log('startMonitoring(): Navigation Observer started on title element.');
        } else {
            console.warn('startMonitoring(): Could not find title element for navigation observer. SPA navigation detection might be less reliable.');
        }

        setTimeout(() => {
            console.log('startMonitoring(): Performing initial ad state check.');
            findVideo();
            processAdState();
        }, 500);
    }

    // --- Message Handling ---
    function handleMessage(request, sender, sendResponse) {
        console.log('handleMessage(): Received message:', request.action, 'from:', sender.id);
        try {
            if (request.action === 'toggleExtension') {
                isEnabled = request.enabled;
                console.log(`handleMessage(): Extension ${isEnabled ? 'enabled' : 'disabled'} by popup/background.`);

                if (isEnabled) {
                    startMonitoring();
                } else {
                    disconnectAllMonitoring();
                    if (isAdActive) {
                        console.log('handleMessage(): Disabling, restoring speed from active ad state.');
                        setVideoSpeed(originalSpeed);
                        isAdActive = false;
                    }
                }
                sendResponse({ success: true, enabled: isEnabled });
            } else if (request.action === 'getStatus') {
                console.log('handleMessage(): Sending status.');
                const v = findVideo();
                sendResponse({
                    enabled: isEnabled,
                    adDetected: isAdActive,
                    currentSpeed: v ? v.playbackRate : 1,
                    maxSupportedSpeed: getMaxSupportedSpeed()
                });
            }
        } catch (error) {
            console.error('handleMessage(): Error handling message in content script:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    // --- Overall Initialization ---
    function initialize() {
        console.log('initialize(): 🚀 YouTube Ad Speed Controller initializing...');

        if (!chrome.runtime.onMessage.hasListener(handleMessage)) {
            chrome.runtime.onMessage.addListener(handleMessage);
            console.log('initialize(): Message listener added.');
        }

        if (document.readyState === 'loading') {
            console.log('initialize(): DOM not yet loaded. Waiting for DOMContentLoaded.');
            document.addEventListener('DOMContentLoaded', startMonitoring);
        } else {
            console.log('initialize(): DOM already loaded. Starting monitoring immediately.');
            startMonitoring();
        }

        window.addEventListener('beforeunload', disconnectAllMonitoring);
        console.log('initialize(): Added beforeunload listener for cleanup.');
    }

    // --- Debugging Helper Function ---
    window.testAdDetection = function() {
        console.log('=== AD DETECTION TEST ===');
        console.log('Current URL:', location.href);
        console.log('Extension Enabled (Internal State):', isEnabled);
        console.log('Ad Active (Internal State):', isAdActive);
        console.log('hasAd() result (Current Scan):', hasAd());
        const v = findVideo();
        console.log('Video element:', v);
        if (v) {
            console.log('Current video speed:', v.playbackRate);
            console.log('Original speed stored:', originalSpeed);
            console.log('Max supported speed:', getMaxSupportedSpeed());
            console.log('Video paused:', v.paused);
            console.log('Video muted:', v.muted);
            console.log('Video duration:', v.duration);
            console.log('Video currentTime:', v.currentTime);
            console.log('Video readyState:', v.readyState);
        } else {
            console.log('No video element found to test.');
        }
        console.log('========================');
    };

    initialize();

})();