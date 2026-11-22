module.exports.searchRoomChat = (query, roomChatList) => {
  if(query.keyword){
    const keywordRegex = new RegExp(query.keyword, "i");
    roomChatList = roomChatList.filter((room) => {
      return keywordRegex.test(room.title);
    });
  }

  if(query.typeRoom){
    const typeRoomRegex = new RegExp(query.typeRoom, "i");
    roomChatList = roomChatList.filter((room) => {
      return typeRoomRegex.test(room.typeRoom);
    });
  }

  return roomChatList;
}