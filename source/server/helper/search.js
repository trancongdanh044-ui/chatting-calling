module.exports.searchRoomChatByTitle = (keyword, roomChatList) => {
  const keywordRegex = new RegExp(keyword, "i");
  roomChatList = roomChatList.filter((room) => {
    return keywordRegex.test(room.title);
  });
  return roomChatList;
}