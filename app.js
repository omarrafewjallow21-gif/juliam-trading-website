/* JULIAM TRADING web application. Supabase client uses the public anon/publishable key. */
(() => {
  const cfg = window.JULIAM_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const money = (n) => `GMD ${Number(n || 0).toLocaleString("en-GM",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const dateText = (d) => d ? new Date(d).toLocaleDateString() : "—";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let supabase, sessionUser, profile, currentPage = "dashboard";
  let cache = {customers:[],shipments:[],regions:[],weights:[],tariffs:[],commissions:[],payments:[]};

  function toast(message, error=false) {
    const el=$("toast"); el.textContent=message; el.className=`toast show${error?" error":""}`;
    setTimeout(()=>el.className="toast",3200);
  }
  function fail(error) { console.error(error); toast(error?.message || "Something went wrong. Please try again.",true); }
  function requireConfig() {
    if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("PASTE_") || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes("PASTE_")) {
      $("connectionLabel").textContent="Configuration needed";
      toast("Add your Supabase URL and publishable/anon key in config.js.",true);
      return false;
    }
    return true;
  }
  async function logAction(action, description, details={}) {
    try { await supabase.from("activity_logs").insert({user_id:sessionUser.id,action,description,details}); }
    catch(e){ console.warn("Activity log could not be saved",e); }
  }
  async function loadProfile() {
    const {data,error}=await supabase.from("profiles").select("*").eq("id",sessionUser.id).single();
    if(error) throw error;
    profile=data;
    if(profile.role!=="manager") throw new Error("This account does not have the manager role. Ask the system administrator to assign role = manager.");
    $("userName").textContent=profile.full_name || sessionUser.email || "Manager";
    $("userRole").textContent=profile.role;
    $("userInitials").textContent=(profile.full_name || sessionUser.email || "JT").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  }
  async function loadData() {
    const requests = await Promise.all([
      supabase.from("customers").select("*").order("created_at",{ascending:false}),
      supabase.from("shipments").select("*,customers(full_name,phone),shipping_regions(name)").order("created_at",{ascending:false}),
      supabase.from("shipping_regions").select("*").order("name"),
      supabase.from("weight_bands").select("*").order("min_weight"),
      supabase.from("tariffs").select("*,shipping_regions(name),weight_bands(label,min_weight,max_weight)").order("updated_at",{ascending:false}),
      supabase.from("commissions").select("*,shipments(receipt_number,created_at,customers(full_name))").order("created_at",{ascending:false}),
      supabase.from("commission_payments").select("*").order("payment_date",{ascending:false})
    ]);
    const keys=["customers","shipments","regions","weights","tariffs","commissions","payments"];
    requests.forEach((r,i)=>{if(r.error) throw r.error;cache[keys[i]]=r.data||[];});
  }
  function showApp() {
    $("loginScreen").classList.add("hidden"); $("appShell").classList.remove("hidden");
    $("connectionLabel").textContent="Secure session";
  }
  function showLogin() { $("appShell").classList.add("hidden"); $("loginScreen").classList.remove("hidden"); }
  async function startSession(user) {
    sessionUser=user;
    await loadProfile();
    showApp(); await refreshAndRender("dashboard");
  }
  async function refreshAndRender(page=currentPage) {
    await loadData(); render(page);
  }
  function setPage(page) {
    currentPage=page;
    document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    $("sidebar").classList.remove("open");
    refreshAndRender(page).catch(fail);
  }
  function pageHead(title,desc,actions="") {
    return `<div class="page-head"><div><h3>${title}</h3><p>${desc}</p></div><div class="toolbar">${actions}</div></div>`;
  }
  function stat(label,value,sub) {
    return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub||""}</div></div>`;
  }
  function table(headers, rows, empty="No records found.") {
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="empty">${empty}</td></tr>`}</tbody></table></div>`;
  }
  function renderDashboard() {
    const total=cache.shipments.reduce((s,x)=>s+Number(x.amount),0);
    const comm=cache.commissions.reduce((s,x)=>s+Number(x.commission_amount),0);
    const delivered=cache.shipments.filter(x=>x.shipment_status==="Delivered").length;
    const outstanding=cache.shipments.filter(x=>x.shipment_status!=="Delivered").length;
    const recent=cache.shipments.slice(0,7).map(s=>`<tr><td><strong>${esc(s.receipt_number)}</strong></td><td>${esc(s.customers?.full_name)}</td><td>${esc(s.destination_country)}</td><td>${money(s.amount)}</td><td><span class="pill ${s.shipment_status==="Delivered"?"green":s.shipment_status==="In Transit"?"blue":""}">${esc(s.shipment_status)}</span></td></tr>`).join("");
    const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-5+i);return {key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,label:d.toLocaleString("en",{month:"short"})};});
    const vals=months.map(m=>cache.shipments.filter(s=>String(s.created_at).slice(0,7)===m.key).reduce((a,s)=>a+Number(s.amount),0));
    const max=Math.max(...vals,1);
    const chart=months.map((m,i)=>`<div class="bar-col"><b>${vals[i]?Math.round(vals[i]/max*100)+"%":"0%"}</b><div class="bar" style="height:${Math.max(vals[i]/max*100,1)}%"></div><small>${m.label}</small></div>`).join("");
    return `${pageHead("Business overview","Your JULIAM TRADING operations at a glance.",`<button class="btn primary" data-action="new-shipment">＋ New shipment</button>`)}
      <div class="stats">${stat("TOTAL SHIPMENTS",cache.shipments.length,"All registered shipments")}${stat("SHIPMENT REVENUE",money(total),"Recorded customer payments")}${stat("COMMISSION EARNED",money(comm),"15% of recorded shipment amounts")}${stat("OUTSTANDING DELIVERIES",outstanding,`${delivered} delivered`)}</div>
      <div class="grid-two"><section class="panel"><h3>Shipment revenue · last 6 months</h3><div class="chart-bars">${chart}</div></section><section class="panel"><h3>Quick actions</h3><div class="quick-links"><button class="btn primary" data-action="new-shipment">Register shipment</button><button class="btn outline" data-page="customers">Add customer</button><button class="btn outline" data-page="tariffs">Manage tariffs</button><button class="btn outline" data-page="commissions">Commission report</button></div><p class="small muted">Commission is calculated separately and is not added to the customer's shipping charge.</p></section></div>
      <section class="table-panel"><div class="table-head"><h3>Recent shipments</h3><button class="mini-btn" data-page="shipments">View all</button></div>${table(["Receipt","Customer","Destination","Amount","Status"],recent)}</section>`;
  }
  function renderShipments() {
    const rows=cache.shipments.map(s=>`<tr><td><strong>${esc(s.receipt_number)}</strong></td><td>${esc(s.customers?.full_name)}</td><td>${esc(s.destination_country)}</td><td>${Number(s.weight_kg).toFixed(2)} kg</td><td>${money(s.amount)}</td><td><span class="pill green">${esc(s.payment_status)}</span></td><td><span class="pill ${s.shipment_status==="Delivered"?"green":s.shipment_status==="In Transit"?"blue":""}">${esc(s.shipment_status)}</span></td><td>${esc(s.dhl_tracking_number||"—")}</td><td><div class="actions"><button class="mini-btn" data-action="receipt" data-id="${s.id}">Receipt</button><button class="mini-btn" data-action="status" data-id="${s.id}">Update</button></div></td></tr>`).join("");
    return `${pageHead("Shipments","Only paid packages should be registered.",`<button class="btn primary" data-action="new-shipment">＋ Register shipment</button><button class="btn outline" data-action="export-shipments">Export CSV</button>`)}<div class="table-panel">${table(["Receipt","Customer","Destination","Weight","Amount","Payment","Delivery status","DHL tracking","Actions"],rows)}</div>`;
  }
  function renderCustomers() {
    const rows=cache.customers.map(c=>`<tr><td><strong>${esc(c.full_name)}</strong></td><td>${esc(c.phone)}</td><td>${esc(c.email||"—")}</td><td>${esc(c.address||"—")}</td><td>${cache.shipments.filter(s=>s.customer_id===c.id).length}</td><td>${dateText(c.created_at)}</td></tr>`).join("");
    return `${pageHead("Customers","Customer directory and shipment history.",`<button class="btn primary" data-action="new-customer">＋ Add customer</button><button class="btn outline" data-action="export-customers">Export CSV</button>`)}<div class="table-panel">${table(["Customer","Phone","Email","Address","Shipments","Added"],rows)}</div>`;
  }
  function renderTariffs() {
    const regions=cache.regions.map(r=>`<tr><td>${esc(r.name)}</td><td><span class="pill ${r.active?"green":"red"}">${r.active?"Active":"Inactive"}</span></td></tr>`).join("");
    const weights=cache.weights.map(w=>`<tr><td>${esc(w.label)}</td><td>${w.min_weight}</td><td>${w.max_weight}</td><td><span class="pill ${w.active?"green":"red"}">${w.active?"Active":"Inactive"}</span></td></tr>`).join("");
    const tariffs=cache.tariffs.map(t=>`<tr><td>${esc(t.shipping_regions?.name)}</td><td>${esc(t.weight_bands?.label)}</td><td>${money(t.price)}</td><td>${dateText(t.updated_at)}</td></tr>`).join("");
    return `${pageHead("Tariff management","Maintain your own destination and weight prices.",`<button class="btn primary" data-action="new-region">＋ Region</button><button class="btn outline" data-action="new-weight">＋ Weight band</button><button class="btn outline" data-action="new-tariff">＋ Set price</button>`)}
      <div class="notice">Important: enter only shipping rates confirmed by JULIAM TRADING / IRO Shipping. The system does not include duties, taxes, insurance or unconfirmed surcharges.</div>
      <div class="grid-two"><section class="table-panel"><div class="table-head"><h3>Shipping regions</h3></div>${table(["Region","Status"],regions)}</section><section class="table-panel"><div class="table-head"><h3>Weight bands</h3></div>${table(["Band","Min kg","Max kg","Status"],weights)}</section></div>
      <section class="table-panel"><div class="table-head"><h3>Shipping price list</h3></div>${table(["Region","Weight band","Price","Last updated"],tariffs)}</section>`;
  }
  function dateFilterMarkup() { return `<div class="toolbar"><label class="small">From <input type="date" id="reportFrom"></label><label class="small">To <input type="date" id="reportTo"></label><button class="btn outline" data-action="filter-reports">Apply dates</button></div>`; }
  function filteredShipments() {
    const from=$("reportFrom")?.value, to=$("reportTo")?.value;
    return cache.shipments.filter(s=>(!from||s.created_at.slice(0,10)>=from)&&(!to||s.created_at.slice(0,10)<=to));
  }
  function renderCommissions() {
    const rows=cache.commissions.map(c=>`<tr><td>${esc(c.shipments?.receipt_number||"—")}</td><td>${esc(c.shipments?.customers?.full_name||"—")}</td><td>${money(c.shipment_amount)}</td><td>15%</td><td><strong>${money(c.commission_amount)}</strong></td><td>${dateText(c.created_at)}</td></tr>`).join("");
    const earned=cache.commissions.reduce((s,c)=>s+Number(c.commission_amount),0);
    const received=cache.payments.reduce((s,p)=>s+Number(p.amount),0);
    return `${pageHead("Commission reports","JULIAM TRADING commission is 15% of each shipment amount.",`<button class="btn outline" data-action="export-commissions">Export CSV</button><button class="btn primary" data-action="commission-payment">＋ Record receipt</button>`)}
      <div class="stats">${stat("TOTAL COMMISSION EARNED",money(earned),"Lifetime earned commission")}${stat("COMMISSION RECEIVED",money(received),"Recorded commission receipts")}${stat("BALANCE NOT RECORDED AS RECEIVED",money(earned-received),"Earned less recorded receipts")}${stat("COMMISSION RATE","15%","Applied automatically")}</div>
      <div class="table-panel"><div class="table-head"><h3>Commission by shipment</h3></div>${table(["Receipt","Customer","Shipment amount","Rate","Commission","Date"],rows)}</div>
      <section class="panel"><h3>Record commission received</h3><div class="toolbar"><input id="commissionAmount" type="number" min="0.01" step="0.01" placeholder="Amount received (GMD)"><input id="commissionDate" type="date"><input id="commissionRef" placeholder="Reference (optional)"><button class="btn primary" data-action="save-commission-payment">Save receipt</button></div></section>
      <div class="table-panel"><div class="table-head"><h3>Commission receipts recorded</h3></div>${table(["Date","Amount","Reference","Notes"],cache.payments.map(p=>`<tr><td>${dateText(p.payment_date)}</td><td>${money(p.amount)}</td><td>${esc(p.reference||"—")}</td><td>${esc(p.notes||"—")}</td></tr>`).join(""))}</div>`;
  }
  function renderReports() {
    const rows=cache.shipments.map(s=>`<tr><td>${dateText(s.created_at)}</td><td>${esc(s.receipt_number)}</td><td>${esc(s.destination_country)}</td><td>${money(s.amount)}</td><td>${money(Number(s.amount)*.15)}</td></tr>`).join("");
    return `${pageHead("Financial reports","Review revenue and estimated commission by date.",`<button class="btn outline" data-action="export-shipments">Export CSV</button>`)}<section class="panel"><h3>Filter shipment records</h3>${dateFilterMarkup()}<div id="filteredSummary" class="stats" style="margin-top:18px"></div></section><div class="table-panel" id="reportTable">${table(["Date","Receipt","Destination","Revenue","15% commission"],rows)}</div>`;
  }
  function renderManifest() {
    const rows=cache.shipments.filter(s=>s.shipment_status!=="Delivered").map(s=>`<tr><td>${esc(s.receipt_number)}</td><td>${esc(s.customers?.full_name)}</td><td>${esc(s.destination_country)}</td><td>${Number(s.weight_kg).toFixed(2)} kg</td><td>${esc(s.dhl_tracking_number||"—")}</td><td>${esc(s.shipment_status)}</td></tr>`).join("");
    return `${pageHead("Shipment manifest","All shipments not yet marked as delivered.",`<button class="btn outline" data-action="print">Print manifest</button>`)}<div class="table-panel">${table(["Receipt","Customer","Destination","Weight","DHL tracking","Status"],rows)}</div>`;
  }
  async function renderActivity() {
    const {data,error}=await supabase.from("activity_logs").select("*").order("created_at",{ascending:false}).limit(200);
    if(error) throw error;
    const rows=(data||[]).map(a=>`<tr><td>${dateText(a.created_at)}</td><td>${new Date(a.created_at).toLocaleTimeString()}</td><td>${esc(a.action)}</td><td>${esc(a.description||"")}</td></tr>`).join("");
    return `${pageHead("Activity log","Recent actions recorded in the management system.")}<div class="table-panel">${table(["Date","Time","Action","Description"],rows)}</div>`;
  }
  function renderBackup() {
    return `${pageHead("Backup & restore","Download a copy of business records for safekeeping.")}<div class="notice">Backups are important on the Supabase Free plan. Keep downloaded files somewhere private and secure. A backup file contains customer and business information.</div><section class="panel"><h3>Download backup</h3><p class="muted small">Export customers, shipments, tariffs, commission records and payments into a JSON file.</p><button class="btn primary" data-action="backup">Download full backup</button></section><section class="panel"><h3>Restore backup</h3><p class="muted small">Restore is not enabled in this first release to avoid accidentally duplicating or overwriting live records. Keep the backup file safe; ask for a reviewed restore process if needed.</p></section>`;
  }
  function render(page) {
    $("pageTitle").textContent=({dashboard:"Dashboard",shipments:"Shipments",customers:"Customers",tariffs:"Tariff management",commissions:"Commission reports",reports:"Financial reports",manifest:"Shipment manifest",activity:"Activity log",backup:"Backup & restore"})[page]||"Dashboard";
    const map={dashboard:renderDashboard,shipments:renderShipments,customers:renderCustomers,tariffs:renderTariffs,commissions:renderCommissions,reports:renderReports,manifest:renderManifest,backup:renderBackup};
    if(page==="activity"){ $("pageContent").innerHTML="<div class='empty'>Loading activity…</div>"; renderActivity().then(html=>$("pageContent").innerHTML=html).catch(fail); return; }
    $("pageContent").innerHTML=(map[page]||renderDashboard)();
    if(page==="reports") updateReportSummary();
  }
  function updateReportSummary() {
    const list=filteredShipments(), revenue=list.reduce((s,x)=>s+Number(x.amount),0), comm=revenue*.15;
    $("filteredSummary").innerHTML=stat("SHIPMENTS",list.length,"In selected period")+stat("REVENUE",money(revenue),"In selected period")+stat("15% COMMISSION",money(comm),"Estimated commission")+stat("DELIVERED",list.filter(s=>s.shipment_status==="Delivered").length,"In selected period");
    const rows=list.map(s=>`<tr><td>${dateText(s.created_at)}</td><td>${esc(s.receipt_number)}</td><td>${esc(s.destination_country)}</td><td>${money(s.amount)}</td><td>${money(Number(s.amount)*.15)}</td></tr>`).join("");
    $("reportTable").innerHTML=table(["Date","Receipt","Destination","Revenue","15% commission"],rows);
  }
  function openDialog(id){$(id).showModal();}
  function closeDialog(id){$(id).close();}
  function fillSelect(id,items,labelFn,valueFn) { $(id).innerHTML=items.map(x=>`<option value="${esc(valueFn(x))}">${esc(labelFn(x))}</option>`).join(""); }
  function openShipment() {
    if(!cache.customers.length){toast("Add a customer before registering a shipment.",true);setPage("customers");return;}
    fillSelect("shipmentCustomer",cache.customers,c=>`${c.full_name} · ${c.phone}`,c=>c.id);
    fillSelect("shipmentRegion",cache.regions.filter(r=>r.active),r=>r.name,r=>r.id);
    $("shipmentTariff").innerHTML='<option value="">Not selected</option>'+cache.tariffs.filter(t=>t.active).map(t=>`<option value="${t.id}">${esc(t.shipping_regions?.name)} · ${esc(t.weight_bands?.label)} · ${money(t.price)}</option>`).join("");
    $("shipmentForm").reset();openDialog("shipmentDialog");
  }
  function receiptHtml(s) {
    return `<div class="receipt"><div class="brand-mark" style="margin:auto">J<span>J</span></div><h2>JULIAM TRADING</h2><p style="text-align:center;font-size:10px;letter-spacing:1px">SHIPMENT PAYMENT RECEIPT</p><div class="receipt-line"><span>Receipt number</span><b>${esc(s.receipt_number)}</b></div><div class="receipt-line"><span>Date</span><b>${dateText(s.created_at)}</b></div><div class="receipt-line"><span>Customer</span><b>${esc(s.customers?.full_name||"")}</b></div><div class="receipt-line"><span>Phone</span><b>${esc(s.customers?.phone||"")}</b></div><div class="receipt-line"><span>Destination</span><b>${esc(s.destination_country)}</b></div><div class="receipt-line"><span>Weight</span><b>${s.weight_kg} kg</b></div><div class="receipt-line"><span>Payment status</span><b>PAID</b></div><div class="receipt-line receipt-total"><span>Amount paid</span><b>${money(s.amount)}</b></div><p style="font-size:10px;color:#777;text-align:center;margin-top:20px">This is a JULIAM TRADING payment receipt, not a DHL-issued waybill. DHL tracking details are subject to the carrier's system.</p><div class="no-print" style="text-align:center;margin-top:18px"><button class="btn primary" onclick="window.print()">Print receipt</button></div></div>`;
  }
  function downloadFile(name,content,type="text/plain") {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
  }
  function toCSV(rows) {
    if(!rows.length)return "";
    const cols=Object.keys(rows[0]);return [cols.join(","),...rows.map(r=>cols.map(k=>`"${String(r[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n");
  }
  async function exportShipments(){downloadFile("juliam-shipments.csv",toCSV(cache.shipments.map(s=>({receipt:s.receipt_number,customer:s.customers?.full_name,destination:s.destination_country,weight_kg:s.weight_kg,amount:s.amount,currency:s.currency,payment_status:s.payment_status,status:s.shipment_status,dhl_tracking:s.dhl_tracking_number,date:s.created_at}))),"text/csv");}
  async function exportCustomers(){downloadFile("juliam-customers.csv",toCSV(cache.customers.map(c=>({name:c.full_name,phone:c.phone,email:c.email,address:c.address,created_at:c.created_at}))),"text/csv");}
  async function exportCommissions(){downloadFile("juliam-commissions.csv",toCSV(cache.commissions.map(c=>({receipt:c.shipments?.receipt_number,customer:c.shipments?.customers?.full_name,shipment_amount:c.shipment_amount,rate:"15%",commission:c.commission_amount,date:c.created_at}))),"text/csv");}
  async function saveShipment(e) {
    e.preventDefault();
    if(!$("paymentConfirmed").checked){toast("Confirm payment before registering.",true);return;}
    const amount=Number($("shipmentAmount").value), customer=$("shipmentCustomer").value;
    if(!customer||!amount||amount<=0){toast("Select a customer and enter a valid amount.",true);return;}
    const receipt=`JUL-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
    const payload={receipt_number:receipt,customer_id:customer,destination_country:$("destinationCountry").value.trim(),region_id:$("shipmentRegion").value||null,weight_kg:Number($("shipmentWeight").value),amount,payment_status:"PAID",payment_method:$("paymentMethod").value||null,paid_at:new Date().toISOString(),tariff_id:$("shipmentTariff").value||null,dhl_tracking_number:$("shipmentTracking").value.trim()||null,notes:$("shipmentNotes").value.trim()||null,created_by:sessionUser.id};
    const {data,error}=await supabase.from("shipments").insert(payload).select("id").single();
    if(error)throw error;
    await logAction("SHIPMENT_CREATED",`Created paid shipment ${receipt}`,{shipment_id:data.id,amount});
    closeDialog("shipmentDialog");toast("Paid shipment registered. Commission generated.");await refreshAndRender("shipments");
  }
  async function saveCustomer(e) {
    e.preventDefault();const payload={full_name:$("customerName").value.trim(),phone:$("customerPhone").value.trim(),email:$("customerEmail").value.trim()||null,address:$("customerAddress").value.trim()||null};
    const {error}=await supabase.from("customers").insert(payload);if(error)throw error;
    await logAction("CUSTOMER_CREATED",`Added customer ${payload.full_name}`);closeDialog("customerDialog");$("customerForm").reset();toast("Customer saved.");await refreshAndRender("customers");
  }
  async function saveRegion(e){e.preventDefault();const name=$("regionName").value.trim();const {error}=await supabase.from("shipping_regions").insert({name});if(error)throw error;await logAction("REGION_CREATED",`Added region ${name}`);closeDialog("regionDialog");$("regionForm").reset();toast("Region added.");await refreshAndRender("tariffs");}
  async function saveWeight(e){e.preventDefault();const min=Number($("weightMin").value),max=Number($("weightMax").value);if(max<=min)throw new Error("Maximum weight must be greater than minimum weight.");const {error}=await supabase.from("weight_bands").insert({label:$("weightLabel").value.trim(),min_weight:min,max_weight:max});if(error)throw error;await logAction("WEIGHT_BAND_CREATED","Added weight band");closeDialog("weightDialog");$("weightForm").reset();toast("Weight band added.");await refreshAndRender("tariffs");}
  async function saveTariff(e){e.preventDefault();const payload={region_id:$("tariffRegion").value,weight_band_id:$("tariffWeight").value,price:Number($("tariffPrice").value),currency:"GMD",active:true,updated_at:new Date().toISOString()};const {error}=await supabase.from("tariffs").upsert(payload,{onConflict:"region_id,weight_band_id"});if(error)throw error;await logAction("TARIFF_UPDATED","Added or updated a shipping tariff",payload);closeDialog("tariffDialog");$("tariffForm").reset();toast("Tariff saved.");await refreshAndRender("tariffs");}
  async function updateShipment(e){e.preventDefault();const id=$("statusShipmentId").value,payload={shipment_status:$("statusValue").value,dhl_tracking_number:$("statusTracking").value.trim()||null};const {error}=await supabase.from("shipments").update(payload).eq("id",id);if(error)throw error;await logAction("SHIPMENT_UPDATED",`Updated shipment ${id}`,payload);closeDialog("statusDialog");toast("Shipment updated.");await refreshAndRender("shipments");}
  async function saveCommissionPayment(){const amount=Number($("commissionAmount").value);if(!amount||amount<=0)throw new Error("Enter a valid amount.");const {error}=await supabase.from("commission_payments").insert({amount,payment_date:$("commissionDate").value||new Date().toISOString().slice(0,10),reference:$("commissionRef").value.trim()||null,recorded_by:sessionUser.id});if(error)throw error;await logAction("COMMISSION_RECEIPT_RECORDED","Recorded commission received",{amount});toast("Commission receipt recorded.");await refreshAndRender("commissions");}
  async function backup(){const names=["customers","shipments","shipping_regions","weight_bands","tariffs","commissions","commission_payments","profiles","activity_logs"],data={exported_at:new Date().toISOString(),system:"JULIAM TRADING",tables:{}};for(const n of names){const {data:rows,error}=await supabase.from(n).select("*");if(error)throw error;data.tables[n]=rows;}downloadFile(`juliam-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),"application/json");toast("Backup downloaded. Store it securely.");}
  async function handleAction(el) {
    const a=el.dataset.action,id=el.dataset.id;
    if(a==="new-shipment")openShipment();
    if(a==="new-customer")openDialog("customerDialog");
    if(a==="new-region")openDialog("regionDialog");
    if(a==="new-weight")openDialog("weightDialog");
    if(a==="new-tariff"){if(!cache.regions.length||!cache.weights.length){toast("Create at least one region and weight band first.",true);return;}fillSelect("tariffRegion",cache.regions.filter(x=>x.active),x=>x.name,x=>x.id);fillSelect("tariffWeight",cache.weights.filter(x=>x.active),x=>x.label,x=>x.id);openDialog("tariffDialog");}
    if(a==="receipt"){const s=cache.shipments.find(x=>x.id===id);if(!s)return;$("pageContent").innerHTML=`${pageHead("Customer receipt","Print or save this payment receipt.",`<button class="btn outline" data-page="shipments">Back to shipments</button>`)}<div class="receipt-wrap">${receiptHtml(s)}</div>`;}
    if(a==="status"){const s=cache.shipments.find(x=>x.id===id);if(!s)return;$("statusShipmentId").value=id;$("statusValue").value=s.shipment_status;$("statusTracking").value=s.dhl_tracking_number||"";openDialog("statusDialog");}
    if(a==="export-shipments")await exportShipments();
    if(a==="export-customers")await exportCustomers();
    if(a==="export-commissions")await exportCommissions();
    if(a==="backup")await backup();
    if(a==="print")window.print();
    if(a==="filter-reports")updateReportSummary();
    if(a==="commission-payment"){$("commissionDate").value=new Date().toISOString().slice(0,10);$("commissionAmount").focus();}
    if(a==="save-commission-payment")await saveCommissionPayment();
  }
  async function init() {
    $("year").textContent=new Date().getFullYear();
    if(!requireConfig())return;
    if(!window.supabase?.createClient){toast("Supabase library did not load. Check your internet connection.",true);return;}
    supabase=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $("loginForm").addEventListener("submit",async e=>{e.preventDefault();try{const {data,error}=await supabase.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error)throw error;await startSession(data.user);}catch(err){fail(err);}});
    $("forgotPassword").addEventListener("click",async()=>{const email=$("loginEmail").value.trim();if(!email){toast("Enter your email address first.",true);return;}try{const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin});if(error)throw error;toast("Password reset instructions sent if the account exists.");}catch(e){fail(e);}});
    $("logoutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();sessionUser=null;profile=null;showLogin();});
    $("mainNav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)setPage(b.dataset.page);});
    $("pageContent").addEventListener("click",async e=>{const p=e.target.closest("[data-page]");if(p){setPage(p.dataset.page);return;}const a=e.target.closest("[data-action]");if(a){try{await handleAction(a);}catch(err){fail(err);}}});
    $("shipmentForm").addEventListener("submit",e=>saveShipment(e).catch(fail));
    $("customerForm").addEventListener("submit",e=>saveCustomer(e).catch(fail));
    $("regionForm").addEventListener("submit",e=>saveRegion(e).catch(fail));
    $("weightForm").addEventListener("submit",e=>saveWeight(e).catch(fail));
    $("tariffForm").addEventListener("submit",e=>saveTariff(e).catch(fail));
    $("statusForm").addEventListener("submit",e=>updateShipment(e).catch(fail));
    document.body.addEventListener("click",e=>{const b=e.target.closest("[data-close]");if(b)closeDialog(b.dataset.close);});
    $("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
    supabase.auth.onAuthStateChange((_event,session)=>{if(!session){showLogin();sessionUser=null;}});
    try{const {data:{session}}=await supabase.auth.getSession();if(session)await startSession(session.user);else showLogin();}catch(e){fail(e);}
  }
  document.addEventListener("DOMContentLoaded",init);
})(); 
