// =====================================================================
// call.js – GỌI THOẠI / VIDEO CALL BẰNG WebRTC
//
// WebRTC giúp 2 trình duyệt gửi hình/tiếng trực tiếp cho nhau, nhưng trước đó
// phải "làm quen" qua server – gọi là SIGNALING. Ở đây dùng socket.io với
// MỘT sự kiện duy nhất: "CALL_SIGNAL", kèm trường `type`:
//
//   invite  : A mời B gọi          accept / reject : B nhận / từ chối
//   cancel  : A huỷ khi B chưa nghe  end : kết thúc cuộc gọi
//   offer / answer : trao đổi mô tả phiên (SDP)   ice : trao đổi đường kết nối
//
// Luồng gọi:  A: invite → B: accept → A: offer → B: answer → hai bên trao ice → nối máy
//
// Server chỉ cần chuyển tiếp CALL_SIGNAL tới người nhận (xem README).
// Khi APP_CONFIG.FEATURES.videoCall = false, file này chạy chế độ DEMO:
// vẫn mở camera/micro thật và hiện đủ giao diện, nhưng không nối với ai.
//
// Cách dùng từ file khác:  Call.start({ id, name, avatar, roomId }, "video" | "audio")
// =====================================================================
var Call = (function () {
  var cfg = window.APP_CONFIG;
  var live = cfg.FEATURES.videoCall;               // false = chế độ demo
  function $(id) { return document.getElementById(id); }

  // ---------- Trạng thái cuộc gọi ----------
  // idle (rảnh) → outgoing (đang gọi) / incoming (có người gọi) → connecting → connected
  var state = "idle";
  var peer = null;                // { id, name, avatar, roomId } – người đối diện
  var callType = "video";         // "video" | "audio"
  var pc = null;                  // RTCPeerConnection
  var localStream = null;         // camera + micro của mình
  var screenStream = null;        // luồng chia sẻ màn hình (nếu đang chia sẻ)
  var pendingCandidates = [];     // ice đến sớm, chờ có remoteDescription
  var ringTimer = null, tickTimer = null;

  // Thông tin của mình (lấy từ avatar ở thanh điều hướng)
  var meAvatar = document.querySelector(".rail-avatar img");
  var myName = meAvatar ? meAvatar.alt : "";
  var myAvatar = meAvatar ? meAvatar.getAttribute("src") : "/client/images/avatar.jpg";

  // ---------- Gửi / nhận tín hiệu ----------
  function signal(type, extra) {
    if (!live || !peer) return;
    socket.emit("CALL_SIGNAL", Object.assign({ toUserId: peer.id, type: type }, extra));
  }

  if (live) {
    // Server xác thực socket bằng cookie tokenUser; client không tự đăng ký userId.
    socket.on("CALL_SIGNAL", onSignal);
    socket.on("CALL_SIGNAL_ERROR", function (data) {
      UI.toast((data && data.message) || "Lỗi tín hiệu cuộc gọi", "error");
    });
    socket.on("connect_error", function () {
      if (state !== "idle") UI.toast("Mất kết nối máy chủ cuộc gọi", "error");
    });
    socket.on("disconnect", function () {
      if (state !== "idle") {
        cleanup();
        UI.toast("Cuộc gọi đã ngắt do mất kết nối máy chủ", "error");
      }
    });
    window.addEventListener("beforeunload", function () {
      if (state !== "idle") {
        var endType = state === "outgoing" ? "cancel" : (state === "incoming" ? "reject" : "end");
        signal(endType, endType === "reject" ? { reason: "declined" } : {});
      }
    });
  }

  async function onSignal(msg) {
    if (msg.type === "invite") return receiveInvite(msg);
    if (!peer || msg.fromUserId !== peer.id) return;      // tín hiệu không thuộc cuộc gọi hiện tại
    try {
      switch (msg.type) {
      case "accept":                                       // B đã nghe máy → A tạo offer
        clearTimeout(ringTimer);
        setState("connecting");
        createPeerConnection();
        var offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signal("offer", { sdp: { type: offer.type, sdp: offer.sdp } });
        break;
      case "offer":                                        // B nhận offer → trả answer
        await pc.setRemoteDescription(msg.sdp);
        flushCandidates();
        var answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signal("answer", { sdp: { type: answer.type, sdp: answer.sdp } });
        break;
      case "answer":                                       // A nhận answer
        await pc.setRemoteDescription(msg.sdp);
        flushCandidates();
        break;
      case "ice":                                          // đường kết nối từ phía bên kia
        if (pc && pc.remoteDescription) await pc.addIceCandidate(msg.candidate);
        else pendingCandidates.push(msg.candidate);
        break;
      case "reject":
        UI.toast(msg.reason === "busy" ? peer.name + " đang bận" : (msg.reason === "timeout" ? peer.name + " không trả lời" : peer.name + " đã từ chối cuộc gọi"), "info");
        cleanup();
        break;
      case "unavailable":
        UI.toast(peer.name + " hiện không trực tuyến", "info");
        cleanup();
        break;
      case "cancel":
        UI.toast("Cuộc gọi nhỡ từ " + peer.name, "info");
        cleanup();
        break;
      case "end":
        UI.toast("Cuộc gọi đã kết thúc", "info");
        cleanup();
        break;
      }
    } catch (error) {
      console.error("WebRTC signaling error:", error);
      UI.toast("Không thể thiết lập cuộc gọi. Vui lòng thử lại.", "error");
      hangup();
    }
  }

  async function flushCandidates() {
    var queued = pendingCandidates.slice();
    pendingCandidates = [];
    for (var i = 0; i < queued.length; i++) {
      try { await pc.addIceCandidate(queued[i]); }
      catch (err) { console.warn("Không thêm được ICE candidate:", err); }
    }
  }

  // ---------- Camera / micro ----------
  async function openLocalMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      UI.toast("Camera/micro chỉ dùng được qua HTTPS hoặc localhost", "error");
      return false;
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
    } catch (err) {
      if (err.name === "NotAllowedError") { UI.toast("Bạn chưa cấp quyền dùng camera/micro cho trang này", "error"); return false; }
      if (callType === "video") {                          // không có camera → thử gọi thoại
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          callType = "audio";
          UI.toast("Không tìm thấy camera, chuyển sang gọi thoại", "info");
        } catch (err2) { UI.toast("Không tìm thấy micro", "error"); return false; }
      } else { UI.toast("Không tìm thấy micro", "error"); return false; }
    }
    $("local-video").srcObject = localStream;
    $("local-video").play().catch(function () {});
    return true;
  }

  // ---------- Kết nối WebRTC ----------
  function createPeerConnection() {
    pc = new RTCPeerConnection({ iceServers: cfg.ICE_SERVERS });
    localStream.getTracks().forEach(function (track) { pc.addTrack(track, localStream); });

    pc.onicecandidate = function (e) { if (e.candidate) signal("ice", { candidate: e.candidate }); };
    pc.ontrack = function (e) {                            // nhận được hình/tiếng của đối phương
      if (e.streams && e.streams[0]) {
        $("remote-video").srcObject = e.streams[0];
        $("remote-video").play().catch(function () {});
      }
      if (callType === "video") $("call-window").classList.add("has-remote");
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === "connected") onConnected();
      if (pc.connectionState === "failed") { UI.toast("Kết nối cuộc gọi thất bại", "error"); hangup(); }
    };
  }

  // ---------- Giao diện theo trạng thái ----------
  function setState(next) {
    state = next;
    var win = $("call-window"), incoming = $("call-incoming");
    incoming.hidden = next !== "incoming";
    win.hidden = next === "idle" || next === "incoming";

    if (next === "incoming") {
      $("incoming-name").textContent = peer.name;
      $("incoming-avatar").src = peer.avatar || "/client/images/avatar.jpg";
      $("incoming-type").textContent = callType === "video" ? "Cuộc gọi video đến…" : "Cuộc gọi thoại đến…";
    }
    if (!win.hidden) {
      win.classList.toggle("audio-only", callType === "audio");
      $("call-name").textContent = peer.name;
      $("call-avatar").src = peer.avatar || "/client/images/avatar.jpg";
      $("call-demo-tag").hidden = live;
      $("btn-cam").hidden = callType === "audio";
      $("btn-screen").hidden = callType === "audio";
      $("call-status").textContent = next === "outgoing" ? "Đang gọi…" : next === "connecting" ? "Đang kết nối…" : "";
    }
  }

  function onConnected() {
    if (state === "connected") return;
    setState("connected");
    $("call-status").textContent = live ? (callType === "audio" ? "Đang trò chuyện" : "") : "Chế độ demo – chưa nối với ai";
    var startedAt = Date.now(), timer = $("call-timer");
    timer.hidden = false;
    tickTimer = setInterval(function () {                  // đồng hồ mm:ss
      var s = Math.floor((Date.now() - startedAt) / 1000);
      timer.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }, 1000);
  }

  // Dọn dẹp mọi thứ, quay về trạng thái rảnh
  function cleanup() {
    clearTimeout(ringTimer);
    clearInterval(tickTimer);
    if (pc) { pc.close(); pc = null; }
    [localStream, screenStream].forEach(function (stream) {
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    });
    localStream = screenStream = null;
    $("local-video").srcObject = null;
    $("remote-video").srcObject = null;
    $("call-window").classList.remove("has-remote");
    $("call-timer").hidden = true;
    ["btn-mic", "btn-cam", "btn-screen"].forEach(function (id) { $(id).classList.remove("off", "on"); });
    $("btn-mic").firstElementChild.className = "fa-solid fa-microphone";
    $("btn-cam").firstElementChild.className = "fa-solid fa-video";
    pendingCandidates = [];
    peer = null;
    setState("idle");
  }

  // ---------- Hành động của người dùng ----------
  // Bắt đầu gọi
  async function start(target, type) {
    if (state !== "idle") return UI.toast("Bạn đang trong một cuộc gọi", "error");
    if (live && !socket.connected) return UI.toast("Chưa kết nối được máy chủ", "error");
    peer = target; callType = type;
    if (!(await openLocalMedia())) { peer = null; return; }
    setState("outgoing");
    if (live) {
      signal("invite", { roomChatId: peer.roomId, callType: callType, fromName: myName, fromAvatar: myAvatar });
      ringTimer = setTimeout(function () {                 // không ai nghe máy
        UI.toast(peer.name + " không trả lời", "info");
        hangup();
      }, cfg.CALL_RING_TIMEOUT_MS);
    } else {
      ringTimer = setTimeout(onConnected, 2500);           // DEMO: giả vờ đã nối máy
    }
  }

  // Có người gọi đến
  function receiveInvite(msg) {
    if (state !== "idle") {                                // đang bận → tự từ chối
      socket.emit("CALL_SIGNAL", { toUserId: msg.fromUserId, type: "reject", reason: "busy" });
      return;
    }
    peer = { id: msg.fromUserId, name: msg.fromName, avatar: msg.fromAvatar, roomId: msg.roomChatId };
    callType = msg.callType;
    setState("incoming");
    ringTimer = setTimeout(function () {
      signal("reject", { reason: "timeout" });
      cleanup();
    }, cfg.CALL_RING_TIMEOUT_MS);   // không bắt máy thì báo lại người gọi
  }

  // Bấm "Trả lời"
  $("btn-accept").addEventListener("click", async function () {
    clearTimeout(ringTimer);
    if (!(await openLocalMedia())) { signal("reject", { reason: "error" }); cleanup(); return; }
    setState("connecting");
    if (live) {
      createPeerConnection();                              // chuẩn bị sẵn trước khi nhận offer
      signal("accept");
    } else {
      onConnected();                                       // DEMO
    }
  });

  // Bấm "Từ chối"
  $("btn-reject").addEventListener("click", function () { signal("reject", { reason: "declined" }); cleanup(); });

  // Bấm nút cúp máy (cũng dùng khi huỷ lúc đang đổ chuông)
  function hangup() {
    if (state !== "idle") {
      var type = state === "outgoing" ? "cancel" : (state === "incoming" ? "reject" : "end");
      signal(type, type === "reject" ? { reason: "declined" } : {});
    }
    cleanup();
  }
  $("btn-hangup").addEventListener("click", hangup);

  // Tắt/bật micro và camera: chỉ cần bật/tắt thuộc tính enabled của track
  function toggleTracks(kind, button, onIcon, offIcon) {
    var tracks = kind === "audio" ? localStream.getAudioTracks() : localStream.getVideoTracks();
    var enable = !(tracks[0] && tracks[0].enabled);
    tracks.forEach(function (t) { t.enabled = enable; });
    button.classList.toggle("off", !enable);
    button.firstElementChild.className = "fa-solid " + (enable ? onIcon : offIcon);
  }
  $("btn-mic").addEventListener("click", function () { if (localStream) toggleTracks("audio", this, "fa-microphone", "fa-microphone-slash"); });
  $("btn-cam").addEventListener("click", function () { if (localStream) toggleTracks("video", this, "fa-video", "fa-video-slash"); });

  // Chia sẻ màn hình: thay track camera bằng track màn hình đang gửi đi
  function replaceVideoTrack(track) {
    if (!pc) return;
    var sender = pc.getSenders().find(function (s) { return s.track && s.track.kind === "video"; });
    if (sender) sender.replaceTrack(track);
  }
  function stopScreenShare() {
    if (!screenStream) return;
    screenStream.getTracks().forEach(function (t) { t.stop(); });
    screenStream = null;
    if (localStream) {
      var cameraTrack = localStream.getVideoTracks()[0];
      if (cameraTrack) replaceVideoTrack(cameraTrack);
      $("local-video").srcObject = localStream;
    }
    $("btn-screen").classList.remove("on");
  }
  $("btn-screen").addEventListener("click", async function () {
    if (screenStream) return stopScreenShare();
    if (!navigator.mediaDevices.getDisplayMedia) return UI.toast("Trình duyệt chưa hỗ trợ chia sẻ màn hình", "error");
    try { screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true }); } catch (err) { return; }
    var track = screenStream.getVideoTracks()[0];
    track.onended = stopScreenShare;                       // người dùng bấm "Dừng chia sẻ" của trình duyệt
    replaceVideoTrack(track);
    $("local-video").srcObject = screenStream;
    this.classList.add("on");
  });

  // ---------- Chế độ DEMO: xem thử giao diện "cuộc gọi đến" ----------
  var demoButton = document.querySelector("[data-demo-incoming]");
  if (demoButton && !live) {
    demoButton.hidden = false;
    demoButton.addEventListener("click", function () {
      document.getElementById("account-modal").hidden = true;
      if (state !== "idle") return;
      peer = { id: "demo", name: "Người bạn (demo)", avatar: "/client/images/avatar.jpg" };
      callType = "video";
      setState("incoming");
    });
  }

  return { start: start };
})();
