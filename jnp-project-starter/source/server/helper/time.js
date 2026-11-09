module.exports.getLastActiveText = (lastActiveAt) => {
    const now = new Date();
    const lastActive = new Date(lastActiveAt);
    const diff = Math.floor((now - lastActive) / 1000);
    if (diff < 60) {
        return `Hoạt động ${diff} giây trước`;
    }
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) {
        return `Hoạt động ${minutes} phút trước`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `Hoạt động ${hours} giờ trước`;
    }
    const days = Math.floor(hours / 24);
    return `Hoạt động ${days} ngày trước`;
}