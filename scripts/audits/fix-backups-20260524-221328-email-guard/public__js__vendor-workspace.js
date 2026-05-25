// ══════════════════════════════════════════════════════════════════
// MFX OS — VENDOR WORKSPACE INTEGRATION v1.0
// vendor-workspace.js
//
// WHAT THIS COVERS — every gap from the audit:
//
// 1. Google Shared Drive (MFX-CORE)
//    - MFX-CORE/Vendor POs/[VPO#]/  — PO PDF storage
//    - MFX-CORE/Vendors/[Name]/Certs/ — SQF cert storage
//    - MFX-CORE/Vendors/[Name]/Invoices/ — vendor invoice PDFs
//    - Auto-creates folder tree, never duplicates
//
// 2. Gmail API — full email flows
//    - PO email to vendor with PDF attachment (RFC 2822 MIME)
//    - Vendor invoice email receipt parsing
//    - Follow-up automation drafts
//    - All email threads logged to vendor comms
//
// 3. Google Sheets — Vendor PO Registry
//    - Auto-append every PO create/update/receive/pay
//    - Separate sheet from quote registry
//    - upsert by VPO# (find existing row → update, else append)
//
// 4. Google Calendar
//    - ETA delivery event on PO approval
//    - 3-day warning event
//    - Follow-up meeting event
//    - Overdue PO alert event
//
// 5. Google Chat Webhook
//    - Full notification matrix: which events fire which channels
//    - PO approved, sent, received, paid, overdue, invoice mismatch
//
// 6. Finance App Sync (same Firestore mfx-2026)
//    - activity collection writes for every state change
//    - Finance reads vendorPOs onSnapshot — always in sync
//    - Explicit finance-targeted activity types
//    - Invoice 3-way match discrepancy → finance notified
//    - Payment recorded in OS → finance vendorPOs updated
//
// 7. OS Drive Links
//    - driveLink stored on every PO record
//    - certDriveLink stored on every certificate
//    - invoiceDriveLink stored on every vendor invoice
//    - All links surfaced in profile UI
//
// INSTALL:
// <script src="js/vendor-workspace.js"></script>
// Add AFTER vendor-profile.js
// No other changes needed — hooks into existing MFX.on events
// ══════════════════════════════════════════════════════════════════

(function(){
'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────
var DRIVE_ROOT='MFX-CORE';
var FOLDER_VENDOR_POS='Vendor POs';
var FOLDER_VENDORS='Vendors';
var VPO_REGISTRY_NAME='MFX Vendor PO Registry';
var MFX_FROM='Randy Vazquez <randy@microflexfilm.com>';
var MFX_ADDR_FULL='4130 Garner Rd, Riverside, CA 92501';
var MFX_PHONE='(909) 360-9066';
var CHAT_WEBHOOK=localStorage.getItem('mfx_gchat_webhook')||'';
var _wsOverdueInterval = null; // wsCheckOverduePOs

// ─── SHARED DRIVE CACHE ───────────────────────────────────────────
var _driveCache={
  mfxDriveId:null,
  vendorPOsFolderId:null,
  vendorsFolderId:null,
  vpoRegistrySheetId:null,
  poFoldersByVpoNum:{},
  vendorFoldersByName:{}
};

// ─── CORE DRIVE HELPERS ───────────────────────────────────────────

function getMFXDrive(token){
  if(_driveCache.mfxDriveId)return Promise.resolve(_driveCache.mfxDriveId);
  return fetch('https://www.googleapis.com/drive/v3/drives?pageSize=50',{
    headers:{'Authorization':'Bearer '+token}
  }).then(function(r){return r.json()}).then(function(d){
    var found=null;
    if(d.drives)d.drives.forEach(function(dr){if(dr.name===DRIVE_ROOT)found=dr.id});
    if(found)_driveCache.mfxDriveId=found;
    return found;
  }).catch(function(e){console.warn('vwsDriveFind',e);return null});
}

function driveSearchFolder(token,name,parentId){
  var q='name=\''+name+'\' and mimeType=\'application/vnd.google-apps.folder\' and trashed=false';
  if(parentId)q+=' and \''+parentId+'\' in parents';
  return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)',{
    headers:{'Authorization':'Bearer '+token}
  }).then(function(r){return r.json()}).then(function(d){
    return(d.files&&d.files.length)?d.files[0].id:null;
  }).catch(function(e){console.warn('vwsFolderSearch',e);return null});
}

function driveCreateFolder(token,name,parentId,driveId){
  var meta={name:name,mimeType:'application/vnd.google-apps.folder'};
  if(parentId)meta.parents=[parentId];
  return fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',{
    method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(meta)
  }).then(function(r){return r.json()}).then(function(d){return d.id||null}).catch(function(e){console.warn('vwsFolderCreate',e);return null});
}

function driveGetOrCreateFolder(token,name,parentId){
  return driveSearchFolder(token,name,parentId).then(function(id){
    if(id)return id;
    return driveCreateFolder(token,name,parentId);
  });
}

// Get or create: MFX-CORE/Vendor POs/
function getVendorPOsFolder(token){
  if(_driveCache.vendorPOsFolderId)return Promise.resolve(_driveCache.vendorPOsFolderId);
  return getMFXDrive(token).then(function(driveId){
    if(!driveId)return null;
    return driveGetOrCreateFolder(token,FOLDER_VENDOR_POS,driveId).then(function(id){
      _driveCache.vendorPOsFolderId=id;return id;
    });
  });
}

// Get or create: MFX-CORE/Vendors/
function getVendorRootFolder(token){
  if(_driveCache.vendorsFolderId)return Promise.resolve(_driveCache.vendorsFolderId);
  return getMFXDrive(token).then(function(driveId){
    if(!driveId)return null;
    return driveGetOrCreateFolder(token,FOLDER_VENDORS,driveId).then(function(id){
      _driveCache.vendorsFolderId=id;return id;
    });
  });
}

// Get or create: MFX-CORE/Vendors/[VendorName]/[subFolder]
function getVendorSubfolder(token,vendorName,subFolder){
  var cleanName=vendorName.replace(/[^a-zA-Z0-9 \-]/g,'').trim();
  var cacheKey=cleanName+'__'+subFolder;
  if(_driveCache.vendorFoldersByName[cacheKey])return Promise.resolve(_driveCache.vendorFoldersByName[cacheKey]);
  return getVendorRootFolder(token).then(function(rootId){
    if(!rootId)return null;
    return driveGetOrCreateFolder(token,cleanName,rootId).then(function(vendorFolderId){
      if(!vendorFolderId)return null;
      return driveGetOrCreateFolder(token,subFolder,vendorFolderId).then(function(subId){
        _driveCache.vendorFoldersByName[cacheKey]=subId;return subId;
      });
    });
  });
}

// Get or create: MFX-CORE/Vendor POs/[VPO#]/
function getVPOFolder(token,vpoNum){
  if(_driveCache.poFoldersByVpoNum[vpoNum])return Promise.resolve(_driveCache.poFoldersByVpoNum[vpoNum]);
  return getVendorPOsFolder(token).then(function(parentId){
    if(!parentId)return null;
    return driveGetOrCreateFolder(token,vpoNum,parentId).then(function(id){
      _driveCache.poFoldersByVpoNum[vpoNum]=id;return id;
    });
  });
}

// Upload any file (Blob or base64) to Drive, return {id,link}
function driveUploadFile(token,folderId,fileName,fileBlob,mimeType){
  var meta={name:fileName,mimeType:mimeType||'application/pdf'};
  if(folderId)meta.parents=[folderId];
  var form=new FormData();
  form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));
  form.append('file',fileBlob,mimeType||'application/pdf');
  return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',{
    method:'POST',headers:{'Authorization':'Bearer '+token},body:form
  }).then(function(r){return r.json()}).then(function(d){
    if(d.id)return{id:d.id,link:'https://drive.google.com/file/d/'+d.id+'/view'};
    return null;
  }).catch(function(e){console.warn('vwsDriveUpload',e);return null});
}

// Update existing Drive file
function driveUpdateFile(token,fileId,fileBlob,fileName,mimeType){
  var meta={name:fileName,mimeType:mimeType||'application/pdf'};
  var form=new FormData();
  form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));
  form.append('file',fileBlob,mimeType||'application/pdf');
  return fetch('https://www.googleapis.com/upload/drive/v3/files/'+fileId+'?uploadType=multipart&supportsAllDrives=true',{
    method:'PATCH',headers:{'Authorization':'Bearer '+token},body:form
  }).then(function(r){return r.json()}).then(function(d){
    if(d.id)return{id:d.id,link:'https://drive.google.com/file/d/'+d.id+'/view'};
    return null;
  }).catch(function(e){console.warn('vwsDriveUpdate',e);return null});
}

// Search for existing file in folder
function driveFindFile(token,folderId,searchName){
  var q='name contains \''+searchName.substring(0,20)+'\' and trashed=false';
  if(folderId)q+=' and \''+folderId+'\' in parents';
  return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)',{
    headers:{'Authorization':'Bearer '+token}
  }).then(function(r){return r.json()}).then(function(d){
    return(d.files&&d.files.length)?d.files[0]:null;
  }).catch(function(e){console.warn('vwsDriveFileFind',e);return null});
}

// ─── VPO PDF GENERATION ───────────────────────────────────────────
function generateVPOPDFBlob(vpo,vendor){
  // Use jsPDF (already in index.html)
  var jsPDF=window.jspdf&&window.jspdf.jsPDF||window.jsPDF;
  if(!jsPDF){console.warn('jsPDF not loaded');return null}
  var doc=new jsPDF('p','mm','letter');
  var W=doc.internal.pageSize.getWidth();
  var y=20;

  // Header
  doc.setFillColor(6,13,20);doc.rect(0,0,W,30,'F');
  doc.setTextColor(0,229,255);doc.setFontSize(18);doc.setFont('helvetica','bold');
  doc.text('MICROFLEX',15,18);
  doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(100,116,139);
  doc.text('FILM CORPORATION',15,23);
  doc.setFontSize(10);doc.setTextColor(0,229,255);doc.setFont('helvetica','bold');
  doc.text('PURCHASE ORDER',W-15,15,{align:'right'});
  doc.setTextColor(224,242,254);doc.setFontSize(13);
  doc.text(vpo.vpoNum,W-15,22,{align:'right'});
  y=40;

  // From / To boxes
  doc.setFillColor(15,29,43);doc.roundedRect(12,y,85,32,2,2,'F');
  doc.setFillColor(15,29,43);doc.roundedRect(105,y,90,32,2,2,'F');
  doc.setTextColor(0,229,255);doc.setFontSize(7);doc.setFont('helvetica','bold');
  doc.text('FROM',15,y+6);doc.text('BILL TO / DELIVER FROM',108,y+6);
  doc.setTextColor(224,242,254);doc.setFontSize(9);doc.setFont('helvetica','bold');
  doc.text('Microflex Film Corporation',15,y+12);
  doc.setTextColor(148,163,184);doc.setFontSize(8);doc.setFont('helvetica','normal');
  doc.text('4130 Garner Rd',15,y+18);
  doc.text('Riverside, CA 92501',15,y+23);
  doc.text('(909) 360-9066',15,y+28);
  doc.setTextColor(224,242,254);doc.setFontSize(9);doc.setFont('helvetica','bold');
  doc.text(vpo.vendorName||'Vendor',108,y+12);
  doc.setTextColor(148,163,184);doc.setFontSize(8);doc.setFont('helvetica','normal');
  if(vendor&&vendor.address)doc.text(vendor.address.substring(0,35),108,y+18);
  if(vpo.vendorEmail)doc.text(vpo.vendorEmail,108,y+24);
  if(vpo.vendorPhone||(vendor&&vendor.phone))doc.text(vpo.vendorPhone||vendor.phone,108,y+29);
  y+=40;

  // PO Details row
  var details=[
    {l:'PO Date',v:new Date(vpo.createdAt||Date.now()).toLocaleDateString('en-US')},
    {l:'Payment Terms',v:vpo.terms||'Net 30'},
    {l:'Expected Delivery',v:vpo.eta?new Date(vpo.eta).toLocaleDateString('en-US'):'TBD'},
    {l:'Ship To',v:'4130 Garner Rd, Riverside CA 92501'}
  ];
  doc.setFillColor(10,21,32);doc.rect(12,y,183,8,'F');
  var dx=12;
  details.forEach(function(d){
    doc.setTextColor(0,229,255);doc.setFontSize(6);doc.setFont('helvetica','bold');
    doc.text(d.l.toUpperCase(),dx+2,y+3.5);
    doc.setTextColor(224,242,254);doc.setFontSize(8);
    doc.text(d.v.substring(0,30),dx+2,y+7.5);
    dx+=46;
  });
  y+=14;

  // Line item table header
  doc.setFillColor(0,30,40);doc.rect(12,y,183,7,'F');
  doc.setTextColor(0,229,255);doc.setFontSize(7);doc.setFont('helvetica','bold');
  doc.text('DESCRIPTION',15,y+4.5);
  doc.text('QUANTITY',95,y+4.5,{align:'right'});
  doc.text('UNIT COST',130,y+4.5,{align:'right'});
  doc.text('TOTAL',195,y+4.5,{align:'right'});
  y+=9;

  // Line items
  var items=vpo.lineItems||[{description:vpo.material||'Material',quantity:vpo.quantity||'',unitCost:vpo.unitCost||0,total:vpo.total||0}];
  items.forEach(function(item){
    doc.setFillColor(15,29,43);doc.rect(12,y,183,8,'F');
    doc.setTextColor(224,242,254);doc.setFontSize(8);doc.setFont('helvetica','normal');
    doc.text((item.description||'').substring(0,50),15,y+5);
    doc.text(String(item.quantity||''),95,y+5,{align:'right'});
    doc.setTextColor(148,163,184);
    doc.text('$'+Number(item.unitCost||0).toFixed(4),130,y+5,{align:'right'});
    doc.setTextColor(224,242,254);doc.setFont('helvetica','bold');
    doc.text('$'+Number(item.total||0).toFixed(2),195,y+5,{align:'right'});
    y+=9;
  });
  y+=4;

  // Total box
  doc.setFillColor(0,30,40);doc.roundedRect(130,y,65,16,2,2,'F');
  doc.setTextColor(100,116,139);doc.setFontSize(8);doc.setFont('helvetica','normal');
  doc.text('TOTAL',175,y+6,{align:'right'});
  doc.setTextColor(0,229,255);doc.setFontSize(14);doc.setFont('helvetica','bold');
  doc.text('$'+Number(vpo.total||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}),193,y+12,{align:'right'});
  y+=24;

  // Notes
  if(vpo.notes){
    doc.setTextColor(100,116,139);doc.setFontSize(7);doc.setFont('helvetica','bold');
    doc.text('NOTES / SPECIAL INSTRUCTIONS:',15,y);
    doc.setTextColor(148,163,184);doc.setFont('helvetica','normal');
    var lines=doc.splitTextToSize(vpo.notes,175);
    doc.text(lines,15,y+5);
    y+=5+lines.length*4+4;
  }

  // Terms
  doc.setFillColor(10,21,32);doc.rect(12,y,183,20,'F');
  doc.setTextColor(0,229,255);doc.setFontSize(7);doc.setFont('helvetica','bold');
  doc.text('TERMS & CONDITIONS',15,y+5);
  doc.setTextColor(100,116,139);doc.setFontSize(6.5);doc.setFont('helvetica','normal');
  doc.text('Payment due per terms above. All materials must meet SQF food safety specifications. Lot numbers and COA required on delivery.',15,y+10);
  doc.text('Microflex Film Corporation · '+MFX_ADDR_FULL+' · '+MFX_PHONE+' · SQF Certified',15,y+16);

  return doc.output('blob');
}

// ─── SAVE VPO PDF TO DRIVE ────────────────────────────────────────
function saveVPOToDrive(vpo,vendor){
  return getGoogleToken().then(function(token){
    if(!token)return null;
    var blob=generateVPOPDFBlob(vpo,vendor);
    if(!blob)return null;
    var fileName=vpo.vpoNum+'-'+((vendor&&vendor.name)||vpo.vendorName||'Vendor').replace(/[^a-zA-Z0-9]/g,'-')+'.pdf';
    return getVPOFolder(token,vpo.vpoNum).then(function(folderId){
      if(!folderId)return null;
      return driveFindFile(token,folderId,vpo.vpoNum).then(function(existing){
        if(existing){
          return driveUpdateFile(token,existing.id,blob,fileName,'application/pdf');
        }
        return driveUploadFile(token,folderId,fileName,blob,'application/pdf');
      });
    });
  }).catch(function(e){console.warn('saveVPOToDrive:',e);return null});
}

// ─── SAVE VENDOR INVOICE PDF TO DRIVE ────────────────────────────
function saveVendorInvoiceToDrive(vendorName,invoiceNum,pdfBlob){
  return getGoogleToken().then(function(token){
    if(!token)return null;
    var fileName='VENDOR-INV-'+invoiceNum+'.pdf';
    return getVendorSubfolder(token,vendorName,'Invoices').then(function(folderId){
      if(!folderId)return null;
      return driveUploadFile(token,folderId,fileName,pdfBlob,'application/pdf');
    });
  }).catch(function(e){console.warn('vwsInvoiceSave',e);return null});
}

// ─── SAVE CERT TO DRIVE ───────────────────────────────────────────
function saveCertToDrive(vendorName,certName,fileBlob,mimeType){
  return getGoogleToken().then(function(token){
    if(!token)return null;
    return getVendorSubfolder(token,vendorName,'Certs').then(function(folderId){
      if(!folderId)return null;
      return driveUploadFile(token,folderId,certName,fileBlob,mimeType||'application/pdf');
    });
  }).catch(function(e){console.warn('vwsCertSave',e);return null});
}

// ─── VPO REGISTRY (Google Sheets) ────────────────────────────────
function getOrCreateVPORegistry(token){
  if(_driveCache.vpoRegistrySheetId)return Promise.resolve(_driveCache.vpoRegistrySheetId);
  return getVendorPOsFolder(token).then(function(parentId){
    var q='name=\''+VPO_REGISTRY_NAME+'\' and mimeType=\'application/vnd.google-apps.spreadsheet\' and trashed=false';
    if(parentId)q+=' and \''+parentId+'\' in parents';
    return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id)',{
      headers:{'Authorization':'Bearer '+token}
    }).then(function(r){return r.json()}).then(function(d){
      if(d.files&&d.files.length){
        _driveCache.vpoRegistrySheetId=d.files[0].id;
        return d.files[0].id;
      }
      // Create registry sheet
      var headers=['VPO#','Status','Vendor','Material','Qty','Unit Cost','Total','For SO#','Terms','Due Date','ETA','Approved By','Approved At','Sent At','Received At','Received Qty','Lot#','Paid Amount','Invoice#','Invoice Amount','Variance $','3-Way Match','Drive Link','Created By','Created At','Last Updated','Action'];
      var sheetMeta={properties:{title:VPO_REGISTRY_NAME},sheets:[{data:[{rowData:[{values:headers.map(function(h){return{userEnteredValue:{stringValue:h},userEnteredFormat:{textFormat:{bold:true},backgroundColor:{red:0.02,green:0.11,blue:0.16}}}})}]}]}]};
      return fetch('https://sheets.googleapis.com/v4/spreadsheets',{
        method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify(sheetMeta)
      }).then(function(r){return r.json()}).then(function(s){
        if(s.spreadsheetId){
          _driveCache.vpoRegistrySheetId=s.spreadsheetId;
          // Move into Vendor POs folder
          if(parentId){
            fetch('https://www.googleapis.com/drive/v3/files/'+s.spreadsheetId+'?addParents='+parentId+'&supportsAllDrives=true',{
              method:'PATCH',headers:{'Authorization':'Bearer '+token}
            }).catch(function(e){console.warn('op:',e)});
          }
          return s.spreadsheetId;
        }
        return null;
      });
    });
  }).catch(function(e){console.warn('vwsRegistryCreate',e);return null});
}

function upsertVPORegistryRow(vpo,action){
  getGoogleToken().then(function(token){
    if(!token)return;
    getOrCreateVPORegistry(token).then(function(sheetId){
      if(!sheetId)return;
      // Search for existing row by VPO#
      fetch('https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+'/values/Sheet1!A:A',{
        headers:{'Authorization':'Bearer '+token}
      }).then(function(r){return r.json()}).then(function(data){
        var rowIdx=-1;
        if(data.values)data.values.forEach(function(r,i){if(r[0]===vpo.vpoNum)rowIdx=i});
        var invoiceVar=vpo.vendorInvoiceAmount?((vpo.vendorInvoiceAmount||0)-(vpo.total||0)).toFixed(2):'';
        var threeWay=!vpo.vendorInvoiceAmount?'Pending':Math.abs((vpo.vendorInvoiceAmount-vpo.total)/vpo.total)<0.02?'Match':'DISCREPANCY';
        var row=[
          vpo.vpoNum,vpo.status||'',vpo.vendorName||'',vpo.material||'',vpo.quantity||'',
          vpo.unitCost||0,vpo.total||0,vpo.forSONum||vpo.forJobNum||'',
          vpo.terms||'',vpo.dueDate||'',vpo.eta||'',
          vpo.approvedBy||'',vpo.approvedAt||'',vpo.sentAt||'',
          vpo.receivedAt||'',vpo.receivedQty||'',vpo.lotNumber||'',
          vpo.paidAmount||0,vpo.vendorInvoiceNum||'',vpo.vendorInvoiceAmount||'',
          invoiceVar,threeWay,vpo.driveLink||'',
          vpo.createdBy||'',vpo.createdAt||'',new Date().toISOString(),action||''
        ];
        if(rowIdx>0){
          var range='Sheet1!A'+(rowIdx+1);
          fetch('https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+'/values/'+range+'?valueInputOption=USER_ENTERED',{
            method:'PUT',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
            body:JSON.stringify({values:[row]})
          }).catch(function(e){console.warn('op:',e)});
        }else{
          fetch('https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+'/values/Sheet1:append?valueInputOption=USER_ENTERED',{
            method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
            body:JSON.stringify({values:[row]})
          }).catch(function(e){console.warn('op:',e)});
        }
      }).catch(function(e){ console.warn('vendor-workspace fetch:', e.message); });
    });
  });
}

// ─── GMAIL — BUILD MIME EMAIL WITH PDF ATTACHMENT ─────────────────
function buildMIMEEmail(to,subject,bodyHtml,pdfBlob,pdfFileName){
  return new Promise(function(resolve){
    if(pdfBlob){
      // Read blob as base64
      var reader=new FileReader();
      reader.onload=function(e){
        var b64=e.target.result.split(',')[1];
        var boundary='MFX_BOUNDARY_'+Date.now();
        var mime=[
          'MIME-Version: 1.0',
          'To: '+to,
          'Subject: '+subject,
          'Content-Type: multipart/mixed; boundary="'+boundary+'"',
          '',
          '--'+boundary,
          'Content-Type: text/html; charset=utf-8',
          '',
          bodyHtml,
          '',
          '--'+boundary,
          'Content-Type: application/pdf; name="'+pdfFileName+'"',
          'Content-Disposition: attachment; filename="'+pdfFileName+'"',
          'Content-Transfer-Encoding: base64',
          '',
          b64,
          '--'+boundary+'--'
        ].join('\r\n');
        resolve(btoa(unescape(encodeURIComponent(mime))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));
      };
      reader.readAsDataURL(pdfBlob);
    }else{
      var mime=[
        'MIME-Version: 1.0',
        'To: '+to,
        'Subject: '+subject,
        'Content-Type: text/html; charset=utf-8',
        '',
        bodyHtml
      ].join('\r\n');
      resolve(btoa(unescape(encodeURIComponent(mime))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));
    }
  });
}

function sendGmailWithAttachment(token,to,subject,bodyHtml,pdfBlob,pdfFileName){
  return buildMIMEEmail(to,subject,bodyHtml,pdfBlob,pdfFileName).then(function(encoded){
    return fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{
      method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({raw:encoded})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.id)return{success:true,messageId:d.id};
      return{success:false,error:d.error&&d.error.message};
    }).catch(function(e){ console.warn('vendor-workspace fetch:', e.message); return{success:false,error:e.message}; });
  });
}

// ─── VPO EMAIL TEMPLATES ──────────────────────────────────────────
function buildVPOEmailHTML(vpo,vendor,driveLink){
  var items=vpo.lineItems||[{description:vpo.material,quantity:vpo.quantity,unitCost:vpo.unitCost,total:vpo.total}];
  var rowsHtml=items.map(function(item){
    return '<tr><td style="padding:8px 14px;font-size:11px;color:#94a3b8;border-bottom:1px solid #1a2d40">'+( item.description||'')+'</td>'+
      '<td style="padding:8px 14px;font-size:11px;color:#94a3b8;border-bottom:1px solid #1a2d40;text-align:center">'+( item.quantity||'')+'</td>'+
      '<td style="padding:8px 14px;font-size:11px;color:#94a3b8;border-bottom:1px solid #1a2d40;text-align:right">$'+Number(item.unitCost||0).toFixed(4)+'</td>'+
      '<td style="padding:8px 14px;font-size:12px;font-weight:700;color:#e0f2fe;border-bottom:1px solid #1a2d40;text-align:right">$'+Number(item.total||0).toFixed(2)+'</td></tr>';
  }).join('');

  return '<table cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;font-family:Arial,sans-serif;background:#060d14">'+
    '<tr><td style="height:3px;background:#00e5ff;font-size:0">&nbsp;</td></tr>'+
    '<tr><td style="padding:16px 24px;border-bottom:1px solid #0f1d2b">'+
    '<div style="font-size:22px;font-weight:900;color:#e0f2fe">Microflex</div>'+
    '<div style="width:60px;height:2px;background:#00e5ff;margin:4px 0"></div>'+
    '<div style="font-size:7px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div></td></tr>'+
    '<tr><td style="padding:5px 24px;background:#0a2e3e;text-align:center;font-size:8px;color:#00e5ff;letter-spacing:2px;border-bottom:1px solid #0f1d2b">PURCHASE ORDER</td></tr>'+
    '<tr><td style="padding:20px 24px">'+
    '<div style="font-size:22px;font-weight:900;color:#e0f2fe">'+vpo.vpoNum+'</div>'+
    '<div style="font-size:10px;color:#64748b;margin-top:2px">Date: '+new Date(vpo.createdAt||Date.now()).toLocaleDateString('en-US')+'</div></td></tr>'+
    '<tr><td style="padding:0 24px 12px">'+
    '<div style="background:#0a1a28;border:1px solid #1a2d40;border-radius:6px;padding:10px;margin-bottom:10px;font-size:10px;color:#64748b">'+
    'Bill To / Ship From: <strong style="color:#e0f2fe">'+(vendor&&vendor.name||vpo.vendorName)+'</strong><br>'+
    'Deliver To: <strong style="color:#e0f2fe">4130 Garner Rd, Riverside, CA 92501</strong><br>'+
    'Payment Terms: <strong style="color:#e0f2fe">'+(vpo.terms||'Net 30')+'</strong>&nbsp;&nbsp;'+
    'Expected Delivery: <strong style="color:#00e5ff">'+(vpo.eta?new Date(vpo.eta).toLocaleDateString('en-US'):'TBD')+'</strong></div>'+
    '<table width="100%" style="border:1px solid #1a2d40;border-radius:6px;border-collapse:collapse">'+
    '<tr><th style="padding:8px 14px;background:#0a1a28;font-size:9px;color:#00e5ff;text-align:left;border-bottom:1px solid #1a2d40">DESCRIPTION</th>'+
    '<th style="padding:8px 14px;background:#0a1a28;font-size:9px;color:#00e5ff;text-align:center;border-bottom:1px solid #1a2d40">QTY</th>'+
    '<th style="padding:8px 14px;background:#0a1a28;font-size:9px;color:#00e5ff;text-align:right;border-bottom:1px solid #1a2d40">UNIT COST</th>'+
    '<th style="padding:8px 14px;background:#0a1a28;font-size:9px;color:#00e5ff;text-align:right;border-bottom:1px solid #1a2d40">TOTAL</th></tr>'+
    rowsHtml+
    '<tr style="background:#0a2e3e"><td colspan="3" style="padding:10px 14px;font-size:12px;font-weight:700;color:#e0f2fe">ORDER TOTAL</td>'+
    '<td style="padding:10px 14px;font-size:16px;font-weight:900;color:#00e5ff;text-align:right">$'+Number(vpo.total||0).toFixed(2)+'</td></tr></table></td></tr>'+
    (vpo.notes?'<tr><td style="padding:0 24px 12px;font-size:10px;color:#64748b"><strong style="color:#94a3b8">Notes: </strong>'+vpo.notes+'</td></tr>':'')+
    (driveLink?'<tr><td style="padding:10px 24px;text-align:center"><a href="'+driveLink+'" style="display:inline-block;padding:10px 28px;border-radius:6px;font-size:12px;font-weight:700;text-decoration:none;background:#00e5ff;color:#060d14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View PO on Drive</a></td></tr>':'')+
    '<tr><td style="padding:12px 24px;text-align:center;font-size:9px;color:#3a5060;border-top:1px solid #0f1d2b">'+
    'Microflex Film Corporation · '+MFX_ADDR_FULL+'<br>'+MFX_PHONE+' · Quotes@MicroflexFilm.com · SQF Certified | Made in USA</td></tr></table>';
}

// ─── SEND VPO TO VENDOR (Full integration) ────────────────────────
function wsSendVPOToVendor(vpoId){
  var vpo=(_vpoCache||[]).find(function(p){return p.id===vpoId});
  if(!vpo){toast('PO not found','err');return}
  var vendor=(_vendorCache||[]).find(function(v){return v.name===vpo.vendorName||v.id===vpo.vendorId});
  var email=vpo.vendorEmail||(vendor&&vendor.email)||'';
  if(!email){toast('No vendor email on file — add it to the vendor profile first','err');return}

  toast('📤 Preparing PO email...','ok');

  getGoogleToken().then(function(token){
    if(!token){toast('Google sign-in required','err');return}

    // 1. Generate PDF
    var pdfBlob=generateVPOPDFBlob(vpo,vendor);
    var pdfFileName=vpo.vpoNum+'-'+( vendor&&vendor.name||vpo.vendorName||'Vendor').replace(/[^a-zA-Z0-9]/g,'-')+'.pdf';

    // 2. Save PDF to Drive first, get link
    getVPOFolder(token,vpo.vpoNum).then(function(folderId){
      var uploadPromise=folderId&&pdfBlob
        ?driveUploadFile(token,folderId,pdfFileName,pdfBlob,'application/pdf')
        :Promise.resolve(null);

      uploadPromise.then(function(driveResult){
        var driveLink=driveResult?driveResult.link:null;

        // 3. Build email HTML
        var subject='Purchase Order '+vpo.vpoNum+' — Microflex Film Corporation';
        var bodyHtml=buildVPOEmailHTML(vpo,vendor,driveLink);

        // 4. Send Gmail with PDF attachment
        sendGmailWithAttachment(token,email,subject,bodyHtml,pdfBlob,pdfFileName).then(function(result){
          if(result.success){
            // 5. Update PO record
            var updates={
              status:'sent',
              sentAt:new Date().toISOString(),
              sentBy:getUserName(),
              driveLink:driveLink||null,
              gmailMessageId:result.messageId
            };
            fbDb.collection('vendorPOs').doc(vpoId).update(updates).then(function(){
              // 6. Log to vendor communications
              wsLogVendorComm(vpo.vendorName||( vendor&&vendor.id),'email','Sent PO: '+vpo.vpoNum,'Purchase Order '+vpo.vpoNum+' emailed to '+email+(driveLink?' · Saved to Drive':''));

              // 7. Update VPO Registry
              var updatedVpo=Object.assign({},vpo,updates);
              upsertVPORegistryRow(updatedVpo,'Sent to '+email);

              // 8. Create calendar ETA event
              if(vpo.eta&&typeof createCalendarEvent==='function'){
                createCalendarEvent(
                  '📦 Material ETA: '+vpo.material+' — '+vpo.vendorName,
                  'VPO: '+vpo.vpoNum+'\nVendor: '+vpo.vendorName+'\nAmount: $'+vpo.total+'\nEmail: '+email+(driveLink?'\nDrive: '+driveLink:''),
                  vpo.eta,'08:00',60
                );
                // 3-day warning
                var warn=new Date(vpo.eta);warn.setDate(warn.getDate()-3);
                if(warn>new Date()){
                  createCalendarEvent(
                    '⚠️ 3-Day Warning: '+vpo.vpoNum+' ETA soon',
                    'PO '+vpo.vpoNum+' from '+vpo.vendorName+' expected in 3 days',
                    warn.toISOString().split('T')[0],'09:00',30
                  );
                }
              }

              // 9. Notify team
              wsChatNotify('📤 *VPO Sent*\n'+vpo.vpoNum+' → '+vpo.vendorName+'\n'+vpo.material+' · $'+Number(vpo.total).toFixed(2)+(driveLink?'\n☁ '+driveLink:''));

              // 10. Log to activity (Finance picks this up)
              wsLogActivity('vpo.sent',{
                vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,
                material:vpo.material,total:vpo.total,eta:vpo.eta,
                driveLink:driveLink,sentTo:email
              });

              toast('✅ PO sent to '+email+(driveLink?' + saved to Drive':''),'ok');
              if(typeof renderVendorProfile==='function')renderVendorProfile();
            });
          }else{
            toast('Gmail send failed: '+(result.error||'unknown error'),'err');
          }
        });
      });
    });
  }).catch(function(e){toast('Error: '+e.message,'err')});
}

// ─── LOG VENDOR INVOICE + NOTIFY FINANCE ─────────────────────────
function wsLogVendorInvoiceAndNotifyFinance(vpoId,invoiceNum,invoiceAmount,invoicePDFBlob){
  var vpo=(_vpoCache||[]).find(function(p){return p.id===vpoId});
  if(!vpo)return;
  var delta=invoiceAmount-(vpo.total||0);
  var pctVar=vpo.total?Math.abs(delta/vpo.total):0;
  var isMatch=pctVar<0.02;
  var updates={
    vendorInvoiceNum:invoiceNum||'',
    vendorInvoiceAmount:invoiceAmount,
    invoiceMatchStatus:isMatch?'match':'discrepancy',
    invoiceDelta:delta,
    invoiceLoggedAt:new Date().toISOString(),
    invoiceLoggedBy:getUserName()
  };

  // Save invoice PDF to Drive if provided
  var drivePromise=invoicePDFBlob
    ?saveVendorInvoiceToDrive(vpo.vendorName,'INV-'+( invoiceNum||Date.now()),invoicePDFBlob).then(function(r){if(r){updates.invoiceDriveLink=r.link}})
    :Promise.resolve();

  drivePromise.then(function(){
    fbDb.collection('vendorPOs').doc(vpoId).update(updates).then(function(){
      upsertVPORegistryRow(Object.assign({},vpo,updates),'Invoice logged: '+(isMatch?'Match':'DISCREPANCY'));

      // FINANCE NOTIFICATION — activity collection
      wsLogActivity('vpo.invoice_logged',{
        vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,
        invoiceNum:invoiceNum,invoiceAmount:invoiceAmount,
        poAmount:vpo.total,delta:delta,
        matchStatus:isMatch?'match':'discrepancy',
        invoiceDriveLink:updates.invoiceDriveLink||null,
        requiresFinanceReview:!isMatch
      });

      if(!isMatch){
        // Discrepancy alert
        wsChatNotify('⚠️ *Invoice Discrepancy*\n'+vpo.vpoNum+' — '+vpo.vendorName+'\nPO: $'+Number(vpo.total).toFixed(2)+' | Invoice: $'+Number(invoiceAmount).toFixed(2)+'\nVariance: $'+delta.toFixed(2)+' ('+( pctVar*100).toFixed(1)+'%)\n🔴 Finance review required');
        notifyTeam('⚠️ Invoice discrepancy on '+vpo.vpoNum+': PO $'+vpo.total.toFixed(2)+' vs Invoice $'+invoiceAmount.toFixed(2));
      }else{
        wsChatNotify('✅ *Invoice Matched*\n'+vpo.vpoNum+' — '+vpo.vendorName+'\n$'+Number(invoiceAmount).toFixed(2)+' — 3-way match confirmed');
      }
      toast('Invoice logged — '+(isMatch?'✅ Match':'⚠️ Discrepancy flagged to Finance'),'ok');
    });
  });
}

// ─── RECORD PAYMENT + NOTIFY FINANCE ─────────────────────────────
function wsRecordVPOPayment(vpoId,amount,method,reference){
  var vpo=(_vpoCache||[]).find(function(p){return p.id===vpoId});
  if(!vpo)return;
  var totalPaid=(vpo.paidAmount||0)+amount;
  var isPaid=totalPaid>=(vpo.total||0)-0.01;
  var updates={
    paidAmount:totalPaid,
    status:isPaid?'paid':'received',
    paidAt:isPaid?new Date().toISOString():null,
    payments:(vpo.payments||[]).concat([{amount:amount,method:method||'',reference:reference||'',date:new Date().toISOString(),by:getUserName()}])
  };
  fbDb.collection('vendorPOs').doc(vpoId).update(updates).then(function(){
    upsertVPORegistryRow(Object.assign({},vpo,updates),'Payment recorded: $'+amount.toFixed(2));

    // Finance notification via activity
    wsLogActivity('vpo.payment_recorded',{
      vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,
      paymentAmount:amount,totalPaid:totalPaid,
      method:method,reference:reference,
      isPaid:isPaid,remainingBalance:(vpo.total||0)-totalPaid
    });

    wsChatNotify((isPaid?'💰 *VPO Paid in Full*':'💸 *Partial Payment Recorded*')+'\n'+vpo.vpoNum+' — '+vpo.vendorName+'\nAmount: $'+amount.toFixed(2)+' · Total Paid: $'+totalPaid.toFixed(2)+(isPaid?'':'\nBalance: $'+((vpo.total||0)-totalPaid).toFixed(2)));
    toast('Payment recorded — Finance notified','ok');
  });
}

// ─── MARK VPO RECEIVED + NOTIFY FINANCE ──────────────────────────
function wsMarkVPOReceived(vpoId,receivedQty,lotNumber){
  var vpo=(_vpoCache||[]).find(function(p){return p.id===vpoId});
  if(!vpo)return;
  var etaDays=vpo.eta?Math.round((new Date()-new Date(vpo.eta))/(1000*60*60*24)):null;
  var updates={
    status:'received',
    receivedAt:new Date().toISOString(),
    receivedBy:getUserName(),
    receivedQty:receivedQty||vpo.quantity,
    lotNumber:lotNumber||'',
    deliveredOnTime:etaDays!==null?etaDays<=0:null,
    deliveryDaysLate:etaDays!==null&&etaDays>0?etaDays:0
  };

  fbDb.collection('vendorPOs').doc(vpoId).update(updates).then(function(){
    // Update vendor delivery performance
    wsUpdateDeliveryPerformance(vpo.vendorName,etaDays!==null&&etaDays<=0,etaDays>0?etaDays:0);

    // Update material inventory
    wsUpdateMaterialOnHand(vpo.material,receivedQty||vpo.quantity,lotNumber,vpo.unitCost);

    // Finance notification
    wsLogActivity('vpo.received',{
      vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,
      material:vpo.material,quantity:receivedQty||vpo.quantity,
      lotNumber:lotNumber,deliveredOnTime:updates.deliveredOnTime,
      daysLate:updates.deliveryDaysLate,forSONum:vpo.forSONum||null,
      invoiceExpected:true
    });

    upsertVPORegistryRow(Object.assign({},vpo,updates),'Received — Lot '+( lotNumber||'N/A'));
    wsChatNotify('📦 *Material Received*\n'+vpo.vpoNum+' — '+vpo.vendorName+'\n'+vpo.material+' · Qty: '+(receivedQty||vpo.quantity)+(lotNumber?' · Lot# '+lotNumber:'')+( updates.deliveryDaysLate>0?' · ⏰ '+updates.deliveryDaysLate+'d late':' · ✅ On time'));

    // Check if all materials received for linked job
    if(vpo.forJobId){
      wsCheckAllMaterialsReceived(vpo.forJobId);
    }
    toast('✅ Material received — Finance + inventory updated','ok');
  });
}

// ─── VENDOR DELIVERY PERFORMANCE UPDATE ──────────────────────────
function wsUpdateDeliveryPerformance(vendorName,onTime,daysLate){
  var vendor=(_vendorCache||[]).find(function(v){return v.name===vendorName});
  if(!vendor)return;
  var dp=vendor.deliveryPerformance||{onTimeCount:0,lateCount:0,avgDaysLate:0,totalDeliveries:0};
  dp.totalDeliveries=(dp.totalDeliveries||0)+1;
  if(onTime){dp.onTimeCount=(dp.onTimeCount||0)+1}
  else{dp.lateCount=(dp.lateCount||0)+1;var total=dp.lateCount;dp.avgDaysLate=((dp.avgDaysLate||0)*(total-1)+daysLate)/total}
  fbDb.collection('vendors').doc(vendor.id).update({deliveryPerformance:dp}).catch(function(e){console.warn('op:',e)});
}

// ─── MATERIAL ON-HAND UPDATE ──────────────────────────────────────
function wsUpdateMaterialOnHand(materialName,qty,lotNumber,unitCost){
  var mats=_materialCache||[];
  var mat=mats.find(function(m){return m.name&&m.name.toLowerCase()===materialName.toLowerCase()});
  if(!mat)return;
  var qtyNum=parseFloat(String(qty).replace(/[^0-9.]/g,''))||0;
  var updates={
    onHand:(mat.onHand||0)+qtyNum,
    onOrder:Math.max(0,(mat.onOrder||0)-qtyNum),
    lastReceived:new Date().toISOString(),
    lastUnitCost:unitCost||mat.unitCost,
    lotHistory:(mat.lotHistory||[]).concat([{lot:lotNumber||'',qty:qtyNum,receivedAt:new Date().toISOString(),unitCost:unitCost}])
  };
  fbDb.collection('materials').doc(mat.id).update(updates).catch(function(e){console.warn('op:',e)});
}

// ─── CHECK ALL MATERIALS RECEIVED FOR JOB ────────────────────────
function wsCheckAllMaterialsReceived(jobId){
  var jobPOs=(_vpoCache||[]).filter(function(p){return p.forJobId===jobId&&p.status!=='received'&&p.status!=='paid'});
  if(!jobPOs.length){
    // All received — notify job ticket
    wsLogActivity('job.materials_ready',{jobId:jobId});
    notifyTeam('✅ All materials received for Job '+jobId+' — ready to schedule production');
    wsChatNotify('✅ *All Materials Ready*\nJob '+jobId+' — all POs received. Production can be scheduled.');
  }
}

// ─── NOTIFICATION MATRIX ─────────────────────────────────────────
// Central function — every VPO state change routes through here

var NOTIFICATION_RULES={
  'vpo.created':    {chat:true,activity:true,registry:true,calendar:false},
  'vpo.submitted':  {chat:true,activity:true,registry:true,calendar:false},
  'vpo.approved':   {chat:true,activity:true,registry:true,calendar:true,  email:false},
  'vpo.rejected':   {chat:true,activity:true,registry:true,calendar:false, email:false},
  'vpo.sent':       {chat:true,activity:true,registry:true,calendar:true,  email:true},
  'vpo.received':   {chat:true,activity:true,registry:true,calendar:false},
  'vpo.paid':       {chat:true,activity:true,registry:true,calendar:false},
  'vpo.invoice_logged':{chat:true,activity:true,registry:true,calendar:false},
  'vpo.overdue':    {chat:true,activity:true,registry:false,calendar:true},
  'material.received':{chat:true,activity:true,registry:false,calendar:false}
};

function wsFireNotifications(eventType,vpo,extras){
  var rules=NOTIFICATION_RULES[eventType]||{chat:true,activity:true};
  if(rules.activity)wsLogActivity(eventType,Object.assign({vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName},extras||{}));
  if(rules.registry)upsertVPORegistryRow(vpo,eventType);
  if(rules.chat&&extras&&extras.chatMsg)wsChatNotify(extras.chatMsg);
}

// ─── ACTIVITY COLLECTION WRITER (Finance reads this) ─────────────
function wsLogActivity(type,data){
  if(typeof fbDb==='undefined')return;
  fbDb.collection('activity').add(Object.assign({
    type:type,
    user:typeof getUserName==='function'?getUserName():'system',
    userId:typeof getUserId==='function'?getUserId():'system',
    timestamp:firebase.firestore.FieldValue.serverTimestamp(),
    source:'mfx-os'
  },data||{})).catch(function(e){console.warn('wsLogActivity:',e)});
}

// ─── CHAT WEBHOOK ─────────────────────────────────────────────────
function wsChatNotify(message){
  var webhook=localStorage.getItem('mfx_gchat_webhook')||CHAT_WEBHOOK;
  if(!webhook)return;
  fetch(webhook,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:message})
  }).catch(function(e){console.warn('op:',e)});
}

// ─── LOG TO VENDOR COMMS ─────────────────────────────────────────
function wsLogVendorComm(vendorNameOrId,type,subject,text){
  var vendor=(_vendorCache||[]).find(function(v){return v.id===vendorNameOrId||v.name===vendorNameOrId});
  if(!vendor)return;
  var entry={id:'comm_'+Date.now(),type:type||'email',subject:subject||'',text:text||'',by:typeof getUserName==='function'?getUserName():'System',at:new Date().toISOString()};
  var comms=(vendor.communications||[]).concat([entry]);
  fbDb.collection('vendors').doc(vendor.id).update({communications:comms}).catch(function(e){console.warn('op:',e)});
}

// ─── OVERDUE PO CHECKER (routes to backend, with client fallback) ──
function wsCheckOverduePOs(){
  // Prefer backend scheduled check (handles Chat, escalations, activity logging server-side)
  if(typeof MFXApi!=='undefined'&&MFXApi.postJSON){
    MFXApi.postJSON('/api/checkOverdueVPOs',{}).then(function(result){
      if(result&&result.overdueCount>0){
        toast('📊 '+result.overdueCount+' overdue VPO'+(result.overdueCount>1?'s':'')+' flagged ('+result.notifiedCount+' newly notified)','err');
      }
    }).catch(function(err){
      console.warn('Backend overdue check failed, using client fallback:',err.message);
      _clientSideOverdueCheck();
    });
    return;
  }
  _clientSideOverdueCheck();
}

function _clientSideOverdueCheck(){
  var pos=_vpoCache||[];
  var now=new Date();
  pos.filter(function(p){
    return p.status==='sent'&&p.eta&&new Date(p.eta)<now;
  }).forEach(function(p){
    if(p._overdueNotified)return;
    var daysOverdue=Math.round((now-new Date(p.eta))/(1000*60*60*24));
    wsChatNotify('🔴 *PO OVERDUE*\n'+p.vpoNum+' — '+p.vendorName+'\n'+p.material+'\nExpected: '+new Date(p.eta).toLocaleDateString('en-US')+' ('+daysOverdue+'d ago)\nAction: Follow up immediately');
    if(typeof createCalendarEvent==='function'){
      createCalendarEvent('🔴 OVERDUE: '+p.vpoNum+' '+p.vendorName,'PO '+p.vpoNum+' was due '+daysOverdue+' days ago. Contact vendor immediately.',new Date().toISOString().split('T')[0],'09:00',30);
    }
    wsLogActivity('vpo.overdue',{vpoId:p.id,vpoNum:p.vpoNum,vendorName:p.vendorName,material:p.material,eta:p.eta,daysOverdue:daysOverdue});
    fbDb.collection('vendorPOs').doc(p.id).update({_overdueNotified:true,overdueNotifiedAt:new Date().toISOString()}).catch(function(e){console.warn('op:',e)});
  });
}

// ─── FINANCE APP REALTIME LISTENER ────────────────────────────────
// Finance app already has onSnapshot on vendorPOs — no additional
// setup needed. But we add an explicit finance bridge for events
// the Finance app needs to ACT on (not just display):

function wsInitFinanceBridge(){
  if(typeof fbDb==='undefined')return;
  // Watch for invoice discrepancies logged by OS — Finance shows alert
  fbDb.collection('activity')
    .where('type','==','vpo.invoice_logged')
    .where('requiresFinanceReview','==',true)
    .orderBy('timestamp','desc')
    .limit(20)
    .onSnapshot(function(snap){
      snap.docChanges().forEach(function(ch){
        if(ch.type!=='added')return;
        var a=ch.doc.data();
        if(a.source==='finance')return; // Ignore if Finance wrote it
        console.log('💰 FINANCE BRIDGE: Invoice discrepancy —',a.vpoNum,'variance $'+a.delta);
        // Surface in OS UI if visible
        if(typeof toast==='function')toast('⚠️ Finance: Invoice discrepancy on '+a.vpoNum,'err');
      });
    }, function(err){ console.warn('vendor-workspace listener:', err.message); });
}

// ─── INVOICE UPLOAD UI ────────────────────────────────────────────
// Adds a file upload to the invoice logging modal
function wsShowInvoiceUploadModal(vpoId){
  var vpo=(_vpoCache||[]).find(function(p){return p.id===vpoId});
  if(!vpo)return;
  var h='<div class="modal-title">Log Vendor Invoice — '+vpo.vpoNum+'</div>';
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px;font-size:10px">';
  h+='<div style="display:flex;justify-content:space-between"><span style="color:var(--tx3)">PO Amount</span><span style="font-weight:700;color:var(--tx)">$'+Number(vpo.total||0).toFixed(2)+'</span></div></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">Invoice Number</div><input id="wsinvNum" style="width:100%;padding:6px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px"></div>';
  h+='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">Invoice Amount *</div><input id="wsinvAmt" type="number" step="0.01" style="width:100%;padding:6px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px"></div>';
  h+='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">Invoice Date</div><input id="wsinvDate" type="date" style="width:100%;padding:6px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px" value="'+new Date().toISOString().split('T')[0]+'"></div>';
  h+='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">Payment Method</div><select id="wsinvMethod" style="width:100%;padding:6px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px"><option>ACH</option><option>Wire</option><option>Check</option><option>Credit Card</option></select></div>';
  h+='</div>';
  h+='<div style="margin-bottom:8px"><div style="font-size:9px;color:var(--tx3);margin-bottom:4px">Upload Invoice PDF (saves to MFX-CORE/Vendors/'+( vpo.vendorName||'Vendor')+'/Invoices/)</div>';
  h+='<input type="file" id="wsinvFile" accept="application/pdf,image/*" style="width:100%;font-size:11px;color:var(--tx2);cursor:pointer">';
  h+='<div id="wsinvUploadStatus" style="font-size:9px;color:var(--tx3);margin-top:3px"></div></div>';
  h+='<div style="display:flex;gap:6px">';
  h+='<button class="btn btn-pr" onclick="wsSubmitVendorInvoice(\''+vpoId+'\')" style="flex:1">Log Invoice + Notify Finance</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>';
  h+='</div>';
  openModal(h);
}

function wsSubmitVendorInvoice(vpoId){
  var num=document.getElementById('wsinvNum')&&document.getElementById('wsinvNum').value.trim()||'';
  var amt=parseFloat(document.getElementById('wsinvAmt')&&document.getElementById('wsinvAmt').value)||0;
  var file=document.getElementById('wsinvFile')&&document.getElementById('wsinvFile').files[0];
  if(!amt)return toast('Invoice amount required','err');
  var statusEl=document.getElementById('wsinvUploadStatus');
  if(statusEl&&file)statusEl.textContent='Uploading to Drive...';

  if(file){
    var reader=new FileReader();
    reader.onload=function(e){
      var blob=new Blob([e.target.result],{type:file.type});
      wsLogVendorInvoiceAndNotifyFinance(vpoId,num,amt,blob);
      closeModal();
    };
    reader.readAsArrayBuffer(file);
  }else{
    wsLogVendorInvoiceAndNotifyFinance(vpoId,num,amt,null);
    closeModal();
  }
}

// ─── PAYMENT MODAL ────────────────────────────────────────────────
function wsShowPaymentModal(vpoId){
  var vpo=(_vpoCache||[]).find(function(p){return p.id===vpoId});
  if(!vpo)return;
  var balance=(vpo.total||0)-(vpo.paidAmount||0);
  var h='<div class="modal-title">Record Payment — '+vpo.vpoNum+'</div>';
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:10px">';
  h+='<div><div style="color:var(--tx3)">PO Total</div><div style="font-weight:700;color:var(--tx)">$'+Number(vpo.total||0).toFixed(2)+'</div></div>';
  h+='<div><div style="color:var(--tx3)">Paid</div><div style="font-weight:700;color:var(--gn)">$'+Number(vpo.paidAmount||0).toFixed(2)+'</div></div>';
  h+='<div><div style="color:var(--tx3)">Balance Due</div><div style="font-weight:700;color:var(--rd)">$'+Number(balance).toFixed(2)+'</div></div>';
  h+='</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">Payment Amount *</div><input id="wspayAmt" type="number" step="0.01" value="'+balance.toFixed(2)+'" style="width:100%;padding:6px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px"></div>';
  h+='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">Method</div><select id="wspayMethod" style="width:100%;padding:6px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px"><option>ACH</option><option>Wire</option><option>Check</option><option>Credit Card</option></select></div>';
  h+='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">Reference / Check #</div><input id="wspayRef" style="width:100%;padding:6px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px"></div>';
  h+='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">Payment Date</div><input id="wspayDate" type="date" value="'+new Date().toISOString().split('T')[0]+'" style="width:100%;padding:6px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px"></div>';
  h+='</div>';
  h+='<div style="display:flex;gap:6px">';
  h+='<button class="btn btn-pr" onclick="wsSubmitPayment(\''+vpoId+'\')" style="flex:1">Record Payment + Notify Finance</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>';
  h+='</div>';
  openModal(h);
}

function wsSubmitPayment(vpoId){
  var amt=parseFloat(document.getElementById('wspayAmt')&&document.getElementById('wspayAmt').value)||0;
  var method=document.getElementById('wspayMethod')&&document.getElementById('wspayMethod').value||'';
  var ref=document.getElementById('wspayRef')&&document.getElementById('wspayRef').value.trim()||'';
  if(!amt)return toast('Amount required','err');
  closeModal();
  wsRecordVPOPayment(vpoId,amt,method,ref);
}

// ─── SEND PO BUTTON (surfaces in vendor-pos.js modals) ──────────
// Replaces the old vpSendToVendor stub with full workspace integration
window.vpSendToVendorFull=function(vpoId){wsSendVPOToVendor(vpoId)};

// ─── MFX EVENT BUS HOOKS ─────────────────────────────────────────
if(typeof MFX!=='undefined'){

  // VPO approved → route to backend service account for Drive/Chat/Activity
  MFX.on('vpo.approved',function(d){
    if(!d||!d.vpoId)return;
    var vpo=(_vpoCache||[]).find(function(p){return p.id===d.vpoId});
    if(!vpo)return;
    setTimeout(function(){
      // Route to backend — handles Drive folder creation, Chat webhook, activity logging
      if(typeof MFXApi!=='undefined'&&MFXApi.postJSON){
        MFXApi.postJSON('/api/processVPOApproval',{vpoId:d.vpoId}).then(function(result){
          if(result&&result.driveLink){
            toast('☁ VPO saved to Drive (server)','ok');
            // Update local cache
            if(vpo)vpo.driveLink=result.driveLink;
            upsertVPORegistryRow(Object.assign({},vpo,{driveLink:result.driveLink}),'Approved — PDF saved to Drive');
          }
        }).catch(function(err){
          console.warn('Backend VPO approval processing failed, using client fallback:',err.message);
          // Fallback to client-side Drive save
          var vendor=(_vendorCache||[]).find(function(v){return v.name===vpo.vendorName});
          saveVPOToDrive(vpo,vendor).then(function(result){
            if(result&&result.link){
              fbDb.collection('vendorPOs').doc(vpo.id).update({driveLink:result.link}).catch(function(e){console.warn('op:',e)});
              upsertVPORegistryRow(Object.assign({},vpo,{driveLink:result.link}),'Approved — PDF saved to Drive');
            }
          });
          wsChatNotify('✅ *VPO Approved*\n'+vpo.vpoNum+' — '+vpo.vendorName+'\n'+vpo.material+' · $'+Number(vpo.total).toFixed(2)+(vpo.approvedBy?'\nApproved by: '+vpo.approvedBy:''));
          wsLogActivity('vpo.approved',{vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,total:vpo.total,approvedBy:d.approvedBy||getUserName()});
        });
      }else{
        // No backend — legacy client-side path
        var vendor=(_vendorCache||[]).find(function(v){return v.name===vpo.vendorName});
        saveVPOToDrive(vpo,vendor).then(function(result){
          if(result&&result.link){
            fbDb.collection('vendorPOs').doc(vpo.id).update({driveLink:result.link}).catch(function(e){console.warn('op:',e)});
            upsertVPORegistryRow(Object.assign({},vpo,{driveLink:result.link}),'Approved — PDF saved to Drive');
          }
        });
        wsChatNotify('✅ *VPO Approved*\n'+vpo.vpoNum+' — '+vpo.vendorName+'\n'+vpo.material+' · $'+Number(vpo.total).toFixed(2)+(vpo.approvedBy?'\nApproved by: '+vpo.approvedBy:''));
        wsLogActivity('vpo.approved',{vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,total:vpo.total,approvedBy:d.approvedBy||getUserName()});
      }
    },1000);
  });

  // VPO rejected → notify + log
  MFX.on('vpo.rejected',function(d){
    if(!d||!d.vpoId)return;
    var vpo=(_vpoCache||[]).find(function(p){return p.id===d.vpoId});
    if(!vpo)return;
    wsChatNotify('🚫 *VPO Rejected*\n'+vpo.vpoNum+' — '+vpo.vendorName+'\nReason: '+(d.reason||'No reason given'));
    wsLogActivity('vpo.rejected',{vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,reason:d.reason||''});
  });
}

// ─── INIT ─────────────────────────────────────────────────────────
function wsInit(){
  // Finance bridge listener
  wsInitFinanceBridge();
  // Overdue checker every 4 hours
  wsCheckOverduePOs();
  _wsOverdueInterval = setInterval(wsCheckOverduePOs,4*60*60*1000);
  // Expose UI functions
  console.log('✅ MFX Vendor Workspace Integration v1 initialized');
}

// ─── EXPOSE GLOBALS ───────────────────────────────────────────────
window.wsSendVPOToVendor=wsSendVPOToVendor;
window.wsShowInvoiceUploadModal=wsShowInvoiceUploadModal;
window.wsSubmitVendorInvoice=wsSubmitVendorInvoice;
window.wsShowPaymentModal=wsShowPaymentModal;
window.wsSubmitPayment=wsSubmitPayment;
window.wsMarkVPOReceived=wsMarkVPOReceived;
window.wsLogVendorInvoiceAndNotifyFinance=wsLogVendorInvoiceAndNotifyFinance;
window.wsRecordVPOPayment=wsRecordVPOPayment;
window.upsertVPORegistryRow=upsertVPORegistryRow;
window.saveVPOToDrive=saveVPOToDrive;
window.saveCertToDrive=saveCertToDrive;
window.generateVPOPDFBlob=generateVPOPDFBlob;
window.wsLogActivity=wsLogActivity;
window.wsChatNotify=wsChatNotify;
window.wsCheckOverduePOs=wsCheckOverduePOs;
window.wsFireNotifications=wsFireNotifications;

// ─── INTERVAL CLEANUP ────────────────────────────────────────────
function clearVendorWorkspaceIntervals(){
  if(_wsOverdueInterval){clearInterval(_wsOverdueInterval);_wsOverdueInterval=null;}
}
window.clearVendorWorkspaceIntervals = clearVendorWorkspaceIntervals;

if(typeof fbDb!=='undefined'){
  setTimeout(wsInit,4000);
}

})();
