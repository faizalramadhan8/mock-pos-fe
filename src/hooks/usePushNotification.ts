import { useState, useEffect, useCallback } from "react";
import { pushApi } from "@/api";
import { getToken } from "@/api/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as unknown as BufferSource;
}

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported] = useState(
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );

  // Check current subscription status
  useEffect(() => {
    if (!supported || !getToken()) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub);
      });
    });
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    setLoading(true);
    try {
      // Register push service worker
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLoading(false);
        return false;
      }

      // Get VAPID key from BE
      const vapidRes = await pushApi.getVapidKey();
      const vapidKey = vapidRes.body?.public_key;
      if (!vapidKey) throw new Error("No VAPID key");

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to BE
      const json = sub.toJSON();
      await pushApi.subscribe({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh || "",
        auth: json.keys?.auth || "",
      });

      setSubscribed(true);
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Push subscription failed:", e);
      setLoading(false);
      return false;
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await pushApi.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      console.error("Push unsubscribe failed:", e);
    }
    setLoading(false);
  }, [supported]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
