// Show alert
const showAlert = document.querySelector("[show-alert]");
if(showAlert){
  const dataTime = parseInt(showAlert.getAttribute("data-time")); 
  setTimeout(() => {
    showAlert.classList.add("alert-hidden");
  }, dataTime);
  
  const closeAlert = showAlert.querySelector("[close-alert]");
  closeAlert.addEventListener("click", () =>{
    showAlert.classList.add("alert-hidden");
  });
}
// End show alert