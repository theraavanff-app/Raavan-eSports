import {initializeApp} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
 getAuth,createUserWithEmailAndPassword,
 signInWithEmailAndPassword,sendEmailVerification,
 sendPasswordResetEmail,signOut,onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
 getFirestore,doc,getDoc,setDoc,collection,addDoc,
 getDocs,query,where,serverTimestamp,runTransaction,
 updateDoc,deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig={
 apiKey:"AIzaSyCtwo7CgwQoPqIeffJ-rXTVKI1EucB9xMc",
 authDomain:"raavan-esports.firebaseapp.com",
 projectId:"raavan-esports",
 storageBucket:"raavan-esports.firebasestorage.app",
 messagingSenderId:"335379689665",
 appId:"1:335379689665:web:1eef94dc57144a081ba440"
};

const ADMIN_EMAIL="the.raavanff@gmail.com";
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

const $=id=>document.getElementById(id);

let user=null,profile=null,tournaments=[];
let mode="login",filter="All",selected=null,editingId=null;

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",
 '"':"&quot;","'":"&#39;"
}[c]));

const isAdmin=()=>!!user &&
 user.email===ADMIN_EMAIL && user.emailVerified;

function toast(s){
 $("toast").textContent=s;
 $("toast").classList.add("show");
 clearTimeout(toast.timer);
 toast.timer=setTimeout(()=>$("toast").classList.remove("show"),2700);
}

function message(id,s,bad=false){
 $(id).textContent=s;
 $(id).style.color=bad?"#ff6b82":"#43dba4";
}

function go(id){
 if(id==="admin"&&!isAdmin()){
  toast("Admin access only");
  id="auth";
 }

 document.querySelectorAll(".screen").forEach(x=>
  x.classList.toggle("active",x.id===id)
 );

 document.querySelectorAll("nav button").forEach(x=>
  x.classList.toggle("active",x.dataset.tab===id)
 );

 $("back").classList.toggle(
  "hidden",["home","wallet","profile"].includes(id)
 );

 if(id==="home")home();
 if(id==="tournaments")renderAll();
 if(id==="details")details();
 if(id==="matches")myMatches();
 if(id==="profile")renderProfile();
 if(id==="wallet")renderWallet();
 if(id==="admin")loadAdmin();

 window.scrollTo(0,0);
}

document.querySelectorAll("[data-page]").forEach(b=>
 b.addEventListener("click",()=>go(b.dataset.page))
);

document.querySelectorAll("nav [data-tab]").forEach(b=>
 b.addEventListener("click",()=>go(b.dataset.tab))
);

$("brand").onclick=e=>{
 e.preventDefault();
 go("home");
};

$("back").onclick=()=>go("tournaments");
$("notice").onclick=()=>toast("Welcome to Raavan eSports!");

$("filters").onclick=e=>{
 let b=e.target.closest("[data-filter]");
 if(!b)return;
 filter=b.dataset.filter;

 document.querySelectorAll("#filters button").forEach(x=>
  x.classList.toggle("selected",x===b)
 );

 renderAll();
};

function dateText(v){
 let d=v?.toDate?v.toDate():new Date(v);
 return isNaN(d)?"Date to be announced":
 d.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
}

function card(t){
 let n=Number(t.registeredCount||0);
 let cap=Number(t.capacity||0);
 let open=t.status==="Open"&&(!cap||n<cap);
 let art=t.category==="CS"?"cs":t.mode==="Solo"?"solo":"";

 return `
 <article class="tour">
  <div class="art ${art}">
   <span class="pill">${esc(t.category||"BR")}</span>
   <span class="free">FREE ENTRY</span>
  </div>

  <div class="tourbody">
   <h3>${esc(t.name)}</h3>
   <p class="sub">${esc(t.mode||"Solo")} TOURNAMENT</p>

   <div class="metrics">
    <div><b>🏆 ${Number(t.prizePoints||0)}</b><small>Reward pts</small></div>
    <div><b>♟ ${n}/${cap||"—"}</b><small>Players</small></div>
    <div><b>${open?"OPEN":"CLOSED"}</b><small>Status</small></div>
   </div>

   <div class="date">◷ ${esc(dateText(t.date))}</div>
   <button class="red wide" data-detail="${esc(t.id)}">
    ${open?"View & Join":"View Details"} →
   </button>
  </div>
 </article>`;
}

function home(){
 $("count").textContent=tournaments.length;
 $("pointsHome").textContent=profile?.points||0;

 $("homeList").innerHTML=tournaments.length?
 tournaments.slice(0,3).map(card).join():
 '<div class="empty">No tournaments yet. Check back soon.</div>';
}

function renderAll(){
 let a=filter==="All"?tournaments:
 tournaments.filter(t=>
  (t.category||"BR")===filter||t.mode===filter
 );

 $("allList").innerHTML=a.length?
 a.map(card).join():
 '<div class="empty">No tournaments in this category.</div>';
}

document.addEventListener("click",e=>{
 let b=e.target.closest("[data-detail]");
 if(b){
  selected=tournaments.find(t=>t.id===b.dataset.detail);
  go("details");
 }
});

function details(){
 let t=selected;

 if(!t){
  $("detail").innerHTML='<div class="empty">Tournament not found.</div>';
  return;
 }

 let open=t.status==="Open"&&
 (!t.capacity||Number(t.registeredCount||0)<Number(t.capacity));

 $("detail").innerHTML=`
 <div class="detailbox">
  <div class="art ${t.category==="CS"?"cs":""}">
   <span class="pill">${esc(t.category||"BR")}</span>
  </div>

  <h2>${esc(t.name)}</h2>
  <div class="row"><span>Date & time</span><b>${esc(dateText(t.date))}</b></div>
  <div class="row"><span>Mode</span><b>${esc(t.mode)}</b></div>
  <div class="row"><span>Map</span><b>${esc(t.map||"TBA")}</b></div>
  <div class="row"><span>Players</span><b>${Number(t.registeredCount||0)} / ${Number(t.capacity||0)}</b></div>
  <div class="row"><span>Entry</span><b>FREE</b></div>
  <div class="row"><span>Reward points</span><b>${Number(t.prizePoints||0)}</b></div>

  <h2 style="margin-top:18px">Tournament Rules</h2>
  <p>${esc(t.rules||"1. Use your valid game account.
2. No cheating or hacking.
3. Respect all players and organizers.
4. Follow match timing announced by admin.")}</p>
 </div>

 <button id="join" class="red wide" ${open?"":"disabled"}>
  ${open?"Join Tournament →":"Registration Closed"}
 </button>`;

 $("join").onclick=()=>join(t.id);
}

async function refresh(){
 try{
  let s=await getDocs(collection(db,"tournaments"));
  tournaments=s.docs.map(d=>({id:d.id,...d.data()}));

  tournaments.sort((a,b)=>
   new Date(a.date?.toDate?a.date.toDate():a.date)-
   new Date(b.date?.toDate?b.date.toDate():b.date)
  );

  home();
  renderAll();

 }catch(e){
  console.error(e);
  $("homeList").innerHTML=
  '<div class="empty">Cannot load tournaments. Check Firestore rules.</div>';
 }
}

async function join(id){
 if(!user){
  toast("Login with verified email first");
  go("auth");
  return;
 }

 let t=tournaments.find(x=>x.id===id);
 let rid=user.uid+"_"+id;

 if(!t||t.status!=="Open"){
  toast("Registration closed");
  return;
 }

 try{
  await runTransaction(db,async tx=>{
   let r=doc(db,"registrations",rid);
   let tr=doc(db,"tournaments",id);

   let rs=await tx.get(r);
   let ts=await tx.get(tr);

   if(rs.exists())throw Error("Already registered");
   if(!ts.exists()||ts.data().status!=="Open")
    throw Error("Registration closed");

   let d=ts.data();

   if(d.capacity&&Number(d.registeredCount||0)>=Number(d.capacity))
    throw Error("Tournament full");

   tx.set(r,{
    uid:user.uid,
    tournamentId:id,
    tournamentName:d.name,
    status:"Registered",
    createdAt:serverTimestamp()
   });
  });

  toast("Registration successful");
  go("matches");

 }catch(e){
  toast(e.message||"Registration failed");
 }
}
async function myMatches(){
 if(!user){
  $("matchesList").innerHTML=
  '<div class="empty">Login to view registrations.</div>';
  return;
 }

 $("matchesList").innerHTML="Loading...";

 try{
  let s=await getDocs(query(
   collection(db,"registrations"),
   where("uid","==",user.uid)
  ));

  $("matchesList").innerHTML=s.empty?
   '<div class="empty">No tournament registrations yet.</div>':
   s.docs.map(d=>`
    <div class="detailbox">
     <h2>${esc(d.data().tournamentName)}</h2>
     <p>Status: ${esc(d.data().status)}</p>
    </div>
   `).join("");

 }catch(e){
  $("matchesList").innerHTML=
  '<div class="empty">Could not load registrations.</div>';
 }
}

function renderProfile(){
 let ok=!!user;

 $("pname").textContent=ok?
  (profile?.displayName||user.email.split("@")[0]):
  "Guest Player";

 $("pemail").textContent=ok?
  user.email:"Login to view your account";

 $("role").textContent=isAdmin()?"ADMIN":ok?"PLAYER":"GUEST";

 $("logout").classList.toggle("hidden",!ok);
 $("adminLink").classList.toggle("hidden",!isAdmin());
}

function renderWallet(){
 $("points").textContent=profile?.points||0;
}

$("logout").onclick=async()=>{
 await signOut(auth);
 toast("Logged out");
 go("home");
};

function authSet(m){
 mode=m;

 $("loginTab").classList.toggle("selected",m==="login");
 $("signupTab").classList.toggle("selected",m==="signup");

 $("nameLabel").classList.toggle("hidden",m!=="signup");

 $("authSubmit").textContent=
  m==="login"?"Login":"Create Account";

 $("forgot").classList.toggle("hidden",m!=="login");

 message("authMsg","");
}

$("loginTab").onclick=()=>authSet("login");
$("signupTab").onclick=()=>authSet("signup");

$("authForm").onsubmit=async e=>{
 e.preventDefault();

 let email=$("email").value.trim().toLowerCase();
 let password=$("password").value;

 try{
  if(mode==="signup"){
   let name=$("name").value.trim();

   if(!name)throw Error("Enter player name");

   let c=await createUserWithEmailAndPassword(
    auth,email,password
   );

   await setDoc(doc(db,"users",c.user.uid),{
    displayName:name,
    email:email,
    points:0,
    createdAt:serverTimestamp()
   });

   await sendEmailVerification(c.user);
   await signOut(auth);

   authSet("login");
   message("authMsg","Account created. Verify email, then login");

  }else{
   let c=await signInWithEmailAndPassword(
    auth,email,password
   );

   if(!c.user.emailVerified){
    await sendEmailVerification(c.user);
    await signOut(auth);
    throw Error("Verify your email first. Verification email sent.");
   }

   toast("Welcome back!");
   go("home");
  }

 }catch(err){
  message("authMsg",err.message,true);
 }
};

$("forgot").onclick=async()=>{
 let e=$("email").value.trim();

 if(!e){
  message("authMsg","Enter your email first",true);
  return;
 }

 try{
  await sendPasswordResetEmail(auth,e);
  message("authMsg","Password reset email sent");
 }catch(x){
  message("authMsg",x.message,true);
 }
};

onAuthStateChanged(auth,async u=>{
 user=u&&u.emailVerified?u:null;
 profile=null;

 if(user){
  try{
   let r=doc(db,"users",user.uid);
   let s=await getDoc(r);

   if(s.exists()){
    profile=s.data();
   }else{
    await setDoc(r,{
     displayName:user.email.split("@")[0],
     email:user.email,
     points:0,
     createdAt:serverTimestamp()
    });

    profile={points:0};
   }

  }catch(e){
   console.error(e);
   toast("Profile error. Check Firestore rules");
  }
 }

 renderProfile();
 renderWallet();
 await refresh();
});

$("tourForm").onsubmit=async e=>{
 e.preventDefault();

 if(!isAdmin())return toast("Admin only");

 let d={
  name:$("tname").value.trim(),
  category:$("category").value,
  mode:$("mode").value,
  date:new Date($("date").value),
  capacity:Number($("capacity").value),
  prizePoints:Number($("prize").value),
  map:$("map").value.trim(),
  rules:$("rules").value.trim()
 };

 if(!d.name||isNaN(d.date)||d.capacity<2||d.prizePoints<0){
  message("adminMsg","Check the form fields",true);
  return;
 }

 try{
  if(editingId){
   await updateDoc(doc(db,"tournaments",editingId),d);
   toast("Tournament updated");
  }else{
   await addDoc(collection(db,"tournaments"),{
    ...d,
    status:"Open",
    registeredCount:0,
    createdBy:user.uid,
    createdAt:serverTimestamp()
   });

   toast("Tournament published");
  }

  resetForm();
  await refresh();
  await loadAdmin();

 }catch(err){
  message("adminMsg",err.message,true);
 }
};

function resetForm(){
 editingId=null;
 $("tourForm").reset();
 $("formTitle").textContent="Create Tournament";
 $("saveTour").textContent="Publish Tournament";
 $("cancelEdit").classList.add("hidden");
}

$("cancelEdit").onclick=resetForm;

async function loadAdmin(){
 if(!isAdmin())return;

 renderManage();

 try{
  let s=await getDocs(collection(db,"registrations"));

  $("adminRegs").innerHTML=s.empty?
   '<div class="empty">No registrations yet.</div>':
   s.docs.map(d=>`
    <div class="detailbox">
     <b>${esc(d.data().tournamentName)}</b>
     <p>Player UID: ${esc(d.data().uid)}</p>
     <p>Status: ${esc(d.data().status)}</p>
    </div>
   `).join("");

 }catch(e){
  $("adminRegs").innerHTML=
  '<div class="empty">Could not load registrations.</div>';
 }
}

function renderManage(){
 $("manageList").innerHTML=tournaments.length?
 tournaments.map(t=>`
  <div class="detailbox">
   <h2>${esc(t.name)}</h2>
   <p>${esc(t.status)} · ${Number(t.registeredCount||0)} registered</p>
   <button class="outline" data-edit="${esc(t.id)}">Edit</button>
   <button class="outline" data-toggle="${esc(t.id)}">
    ${t.status==="Open"?"Close":"Open"}
   </button>
   <button class="outline" data-delete="${esc(t.id)}">Delete</button>
  </div>
 `).join(""):
 '<div class="empty">No tournaments created.</div>';
}

document.addEventListener("click",async e=>{
 let ed=e.target.closest("[data-edit]");
 let tg=e.target.closest("[data-toggle]");
 let dl=e.target.closest("[data-delete]");

 if(ed){
  let t=tournaments.find(x=>x.id===ed.dataset.edit);
  if(!t)return;

  editingId=t.id;

  $("tname").value=t.name||"";
  $("category").value=t.category||"BR";
  $("mode").value=t.mode||"Solo";

  let dt=t.date?.toDate?t.date.toDate():new Date(t.date);

  $("date").value=isNaN(dt)?"":
   new Date(dt-dt.getTimezoneOffset()*60000)
   .toISOString().slice(0,16);

  $("capacity").value=t.capacity||48;
  $("prize").value=t.prizePoints||0;
  $("map").value=t.map||"";
  $("rules").value=t.rules||"";

  $("formTitle").textContent="Edit Tournament";
  $("saveTour").textContent="Save Changes";
  $("cancelEdit").classList.remove("hidden");

  window.scrollTo(0,0);
 }

 if(tg&&isAdmin()){
  let t=tournaments.find(x=>x.id===tg.dataset.toggle);

  try{
   await updateDoc(doc(db,"tournaments",t.id),{
    status:t.status==="Open"?"Closed":"Open"
   });

   await refresh();
   renderManage();

  }catch(x){
   toast(x.message);
  }
 }

 if(dl&&isAdmin()&&confirm("Delete this tournament?")){
  try{
   await deleteDoc(doc(db,"tournaments",dl.dataset.delete));
   await refresh();
   renderManage();
   toast("Deleted");

  }catch(x){
   toast(x.message);
  }
 }
});

authSet("login");
go("home");
refresh();