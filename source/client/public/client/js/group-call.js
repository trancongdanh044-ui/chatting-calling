// =====================================================================
// group-call.js – GỌI NHÓM (thoại / video) BẰNG WebRTC, kiểu "mesh"
//
// Mỗi người trong cuộc gọi nối trực tiếp với TỪNG người còn lại (mỗi cặp một RTCPeerConnection),
// nên chỉ phù hợp nhóm nhỏ (tối đa 4 người – xem MAX_PARTICIPANTS ở server).
// Signaling dùng MỘT sự kiện socket.io: "GROUP_CALL_SIGNAL", kèm trường `type`:
//
//   client → server : join (vào/bắt đầu gọi) · leave · offer · answer · ice
//   server → client : invite (có cuộc gọi nhóm) · joined (mình đã vào, kèm danh sách người đang gọi)
//                     participant-joined / participant-left · offer · answer · ice
//                     ended (cuộc gọi đã kết thúc) · full (đủ người) · error
//
// Luồng: A bấm gọi → join → cả nhóm nhận invite → B bấm Trả lời → join →
//        B nhận danh sách [A] và tạo offer tới A; A nhận participant-joined và chờ offer của B.
//        Người vào sau luôn là bên tạo offer tới những người đã có mặt.
//
// Cách dùng từ file khác:  GroupCall.start({ roomId, name, avatar }, "video" | "audio")
// =====================================================================
var GroupCall = (function () {
  var cfg = window.APP_CONFIG;
  function $(id) { return document.getElementById(id); }

  // idle (rảnh) → incoming (có lời mời) | in-call (đang ở trong cuộc gọi)
  var state = "idle";
  var room = null;                 // { roomId, name, avatar } – nhóm đang gọi
  var callType = "video";          // "video" | "audio"
  var localStream = null;
  var peers = {};                  // userId -> { id, name, avatar, pc, tile, pending: [] }
  var invite = null;               // lời mời đang hiển thị
  var inviteTimer = null, ringTimer = null, tickTimer = null;

  // Tên + avatar của mình (lấy từ avatar ở thanh điều hướng, giống call.js)
  var meAvatar = document.querySelector(".rail-avatar img");
  var myName = meAvatar ? meAvatar.alt : "Bạn";
  var myAvatar = meAvatar ? meAvatar.getAttribute("src") : "/client/images/avatar.jpg";

  function isBusy() { return state !== "idle"; }

  // ---------- Gửi / nhận tín hiệu ----------
  function signal(type, extra) {
    if (!room) return;
    socket.emit("GROUP_CALL_SIGNAL", Object.assign({ type: type, roomChatId: room.roomId }, extra));
  }

  socket.on("GROUP_CALL_SIGNAL", onSignal);
  socket.on("disconnect", function () {
    if (state === "in-call") { cleanup(); UI.toast("Cuộc gọi đã ngắt do mất kết nối máy chủ", "error"); }
  });
  window.addEventListener("beforeunload", function () { if (state === "in-call") signal("leave"); });

  async function onSignal(msg) {
    switch (msg.type) {
    case "invite":
      return receiveInvite(msg);
    case "ended":
      if (state === "incoming" && invite && invite.roomChatId === msg.roomChatId) hideInvite();
      return;
    }
    if (state !== "in-call" || !room || msg.roomChatId !== room.roomId) return;   // không thuộc cuộc gọi hiện tại

    switch (msg.type) {
    case "joined":                                       // mình đã vào → tạo offer tới những người đang gọi
      callType = msg.callType;
      showWindow();
      if (msg.participants.length === 0) {
        ringTimer = setTimeout(function () {             // không ai tham gia
          UI.toast("Chưa có ai tham gia cuộc gọi", "info");
          hangup();
        }, cfg.CALL_RING_TIMEOUT_MS);
      }
      for (var i = 0; i < msg.participants.length; i++) {
        var p = msg.participants[i];
        await sendOffer(ensurePeer(p.userId, p.name, p.avatar));
      }
      break;
    case "participant-joined":                           // có người vào sau → chờ họ gửi offer
      ensurePeer(msg.userId, msg.name, msg.avatar);
      UI.toast(msg.name + " đã tham gia cuộc gọi", "info");
      break;
    case "participant-left":
      removePeer(msg.userId, true);
      break;
    case "offer": case "answer": case "ice":
      await onPeerSignal(msg);
      break;
    case "full":
      UI.toast("Cuộc gọi nhóm đã đủ người", "error");
      cleanup();
      break;
    case "error":
      UI.toast(msg.reason === "busy" ? "Bạn đang trong một cuộc gọi nhóm khác" : "Không thể tham gia cuộc gọi nhóm", "error");
      cleanup();
      break;
    }
  }

  // ---------- Kết nối với từng người ----------
  function ensurePeer(userId, name, avatar) {
    if (peers[userId]) return peers[userId];
    clearTimeout(ringTimer);
    var tile = createTile(name, avatar, false);
    var pc = new RTCPeerConnection({ iceServers: cfg.ICE_SERVERS });
    localStream.getTracks().forEach(function (track) { pc.addTrack(track, localStream); });

    pc.onicecandidate = function (e) { if (e.candidate) signal("ice", { toUserId: userId, candidate: e.candidate }); };
    pc.ontrack = function (e) {
      var video = tile.querySelector("video");
      if (e.streams && e.streams[0]) { video.srcObject = e.streams[0]; video.play().catch(function () {}); }
      if (e.track.kind === "video") tile.classList.add("has-video");
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === "connected") startTimer();
      if (pc.connectionState === "failed") { UI.toast("Mất kết nối với " + name, "error"); removePeer(userId, false); }
    };

    peers[userId] = { id: userId, name: name, avatar: avatar, pc: pc, tile: tile, pending: [] };
    updateLayout();
    return peers[userId];
  }

  async function sendOffer(peer) {
    try {
      var offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      signal("offer", { toUserId: peer.id, sdp: { type: offer.type, sdp: offer.sdp } });
    } catch (error) {
      console.error("Group call offer error:", error);
      UI.toast("Không thể kết nối với " + peer.name, "error");
      removePeer(peer.id, false);
    }
  }

  async function onPeerSignal(msg) {
    var peer = ensurePeer(msg.fromUserId, msg.fromName, msg.fromAvatar);   // offer có thể đến trước participant-joined
    try {
      if (msg.type === "offer") {
        await peer.pc.setRemoteDescription(msg.sdp);
        await flushCandidates(peer);
        var answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        signal("answer", { toUserId: peer.id, sdp: { type: answer.type, sdp: answer.sdp } });
      } else if (msg.type === "answer") {
        await peer.pc.setRemoteDescription(msg.sdp);
        await flushCandidates(peer);
      } else if (peer.pc.remoteDescription) {
        await peer.pc.addIceCandidate(msg.candidate);
      } else {
        peer.pending.push(msg.candidate);                // ice đến sớm, chờ có remoteDescription
      }
    } catch (error) {
      console.error("Group call signaling error:", error);
      UI.toast("Không thể kết nối với " + peer.name, "error");
      removePeer(peer.id, false);
    }
  }

  async function flushCandidates(peer) {
    var queued = peer.pending.slice();
    peer.pending = [];
    for (var i = 0; i < queued.length; i++) {
      try { await peer.pc.addIceCandidate(queued[i]); }
      catch (err) { console.warn("Không thêm được ICE candidate:", err); }
    }
  }

  function removePeer(userId, notify) {
    var peer = peers[userId];
    if (!peer) return;
    peer.pc.close();
    peer.tile.remove();
    delete peers[userId];
    updateLayout();
    if (notify) UI.toast(peer.name + " đã rời cuộc gọi", "info");
    if (state === "in-call" && Object.keys(peers).length === 0) {   // chỉ còn mình mình
      UI.toast("Mọi người đã rời cuộc gọi", "info");
      hangup();
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
      if (callType === "video") {                        // không có camera → thử gọi thoại
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          callType = "audio";
          UI.toast("Không tìm thấy camera, chuyển sang gọi thoại", "info");
        } catch (err2) { UI.toast("Không tìm thấy micro", "error"); return false; }
      } else { UI.toast("Không tìm thấy micro", "error"); return false; }
    }
    return true;
  }

  // ---------- Giao diện ----------
  function createTile(name, avatar, isLocal) {
    var tile = document.createElement("div");
    tile.className = "gc-tile" + (isLocal ? " local" : "");
    var video = document.createElement("video");
    video.autoplay = true;
    video.setAttribute("playsinline", "");
    if (isLocal) video.muted = true;
    var img = document.createElement("img");
    img.className = "gc-avatar";
    img.alt = "";
    img.src = avatar || "/client/images/avatar.jpg";
    var label = document.createElement("span");
    label.className = "gc-name";
    label.textContent = isLocal ? "Bạn" : name;
    tile.appendChild(video);
    tile.appendChild(img);
    tile.appendChild(label);
    $("gc-grid").appendChild(tile);
    return tile;
  }

  function updateLayout() {
    var grid = $("gc-grid");
    grid.dataset.count = grid.children.length;
    $("gc-count").textContent = grid.children.length + " người";
  }

  function showWindow() {
    $("gc-name").textContent = room.name;
    $("gc-cam").hidden = localStream.getVideoTracks().length === 0;
    $("gc-window").hidden = false;
    if ($("gc-grid").querySelector(".local")) return;
    var tile = createTile(myName, myAvatar, true);       // khung hình của chính mình
    var video = tile.querySelector("video");
    video.srcObject = localStream;
    video.play().catch(function () {});
    if (localStream.getVideoTracks().length > 0) tile.classList.add("has-video");
    updateLayout();
  }

  function startTimer() {
    if (tickTimer) return;
    var startedAt = Date.now(), timer = $("gc-timer");
    timer.hidden = false;
    tickTimer = setInterval(function () {                // đồng hồ mm:ss
      var s = Math.floor((Date.now() - startedAt) / 1000);
      timer.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }, 1000);
  }

  // Dọn dẹp mọi thứ, quay về trạng thái rảnh
  function cleanup() {
    clearTimeout(ringTimer);
    clearInterval(tickTimer);
    tickTimer = null;
    Object.keys(peers).forEach(function (id) { peers[id].pc.close(); });
    peers = {};
    if (localStream) localStream.getTracks().forEach(function (t) { t.stop(); });
    localStream = null;
    $("gc-grid").innerHTML = "";
    $("gc-window").hidden = true;
    $("gc-timer").hidden = true;
    ["gc-mic", "gc-cam"].forEach(function (id) { $(id).classList.remove("off"); });
    $("gc-mic").firstElementChild.className = "fa-solid fa-microphone";
    $("gc-cam").firstElementChild.className = "fa-solid fa-video";
    room = null;
    state = "idle";
  }

  // ---------- Hành động của người dùng ----------
  // Bắt đầu gọi nhóm (hoặc vào cuộc gọi nhóm đang diễn ra)
  async function start(target, type) {
    if (state !== "idle" || (window.Call && Call.isBusy())) return UI.toast("Bạn đang trong một cuộc gọi", "error");
    if (!socket.connected) return UI.toast("Chưa kết nối được máy chủ", "error");
    room = target; callType = type;
    state = "in-call";
    if (!(await openLocalMedia())) { room = null; state = "idle"; return; }
    signal("join", { callType: callType });
  }

  // Lời mời gọi nhóm
  function receiveInvite(msg) {
    if (state !== "idle" || (window.Call && Call.isBusy())) return;   // đang bận thì bỏ qua
    invite = msg;
    state = "incoming";
    $("gc-incoming-avatar").src = msg.roomAvatar || "/client/images/group-avatar.png";
    $("gc-incoming-name").textContent = msg.roomName;
    $("gc-incoming-type").textContent = msg.fromName + " đang gọi " + (msg.callType === "video" ? "video" : "thoại") + "…";
    $("gc-incoming").hidden = false;
    inviteTimer = setTimeout(hideInvite, cfg.CALL_RING_TIMEOUT_MS);   // không ai nhấc máy thì tự tắt
  }

  function hideInvite() {
    clearTimeout(inviteTimer);
    $("gc-incoming").hidden = true;
    invite = null;
    if (state === "incoming") state = "idle";
  }

  $("gc-accept").addEventListener("click", function () {
    if (!invite) return;
    var inv = invite;
    hideInvite();
    start({ roomId: inv.roomChatId, name: inv.roomName, avatar: inv.roomAvatar }, inv.callType);
  });
  $("gc-reject").addEventListener("click", hideInvite);

  // Rời cuộc gọi
  function hangup() {
    if (state === "in-call") signal("leave");
    cleanup();
  }
  $("gc-hangup").addEventListener("click", hangup);

  // Tắt/bật micro và camera: bật/tắt thuộc tính enabled của track
  function toggleTracks(kind, button, onIcon, offIcon) {
    var tracks = kind === "audio" ? localStream.getAudioTracks() : localStream.getVideoTracks();
    var enable = !(tracks[0] && tracks[0].enabled);
    tracks.forEach(function (t) { t.enabled = enable; });
    button.classList.toggle("off", !enable);
    button.firstElementChild.className = "fa-solid " + (enable ? onIcon : offIcon);
    if (kind === "video") $("gc-grid").querySelector(".local").classList.toggle("has-video", enable);
  }
  $("gc-mic").addEventListener("click", function () { if (localStream) toggleTracks("audio", this, "fa-microphone", "fa-microphone-slash"); });
  $("gc-cam").addEventListener("click", function () { if (localStream) toggleTracks("video", this, "fa-video", "fa-video-slash"); });

  return { start: start, isBusy: isBusy };
})();
