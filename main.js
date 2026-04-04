/* 더에셋스퀘어 Sub3 — Interactive Features */
(function(){'use strict';

/* FAQ Accordion */
document.addEventListener('click',function(e){
  var q=e.target.closest('.faq-q');
  if(!q)return;
  var item=q.closest('.faq-item'),was=item.classList.contains('open');
  var list=item.parentElement;
  if(list)list.querySelectorAll('.faq-item.open').forEach(function(el){el.classList.remove('open')});
  if(!was)item.classList.add('open');
});

/* Checklist */
function initChecklists(){
  document.querySelectorAll('.checklist').forEach(function(cl){
    var id=cl.getAttribute('data-id')||'default';
    var saved=JSON.parse(sessionStorage.getItem('cl_'+id)||'[]');
    cl.querySelectorAll('.cl-item').forEach(function(item,i){
      if(saved.indexOf(i)>-1)item.classList.add('checked');
      item.addEventListener('click',function(){
        item.classList.toggle('checked');
        updateProgress(cl,id);
      });
    });
    updateProgress(cl,id);
  });
}
function updateProgress(cl,id){
  var items=cl.querySelectorAll('.cl-item');
  var checked=cl.querySelectorAll('.cl-item.checked');
  var pct=items.length?Math.round((checked.length/items.length)*100):0;
  var bar=cl.querySelector('.cl-bar');
  if(bar)bar.style.width=pct+'%';
  var indices=[];
  items.forEach(function(item,i){if(item.classList.contains('checked'))indices.push(i)});
  sessionStorage.setItem('cl_'+id,JSON.stringify(indices));
}

/* Gallery */
function initGalleries(){
  document.querySelectorAll('.gallery').forEach(function(g){
    var track=g.querySelector('.gallery-track');
    var slides=g.querySelectorAll('.gallery-slide');
    var prev=g.querySelector('.g-prev');
    var next=g.querySelector('.g-next');
    var dots=g.querySelectorAll('.gallery-dot');
    var cur=0,total=slides.length;
    if(!total)return;
    var sx=0,dx=0;
    track.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});
    track.addEventListener('touchmove',function(e){dx=e.touches[0].clientX-sx},{passive:true});
    track.addEventListener('touchend',function(){
      if(Math.abs(dx)>50){if(dx<0&&cur<total-1)cur++;else if(dx>0&&cur>0)cur--; go(cur)}dx=0;
    });
    function go(i){cur=i;track.style.transform='translateX(-'+(cur*100)+'%)';
      dots.forEach(function(d,j){d.classList.toggle('active',j===cur)});
      if(prev)prev.disabled=cur===0;if(next)next.disabled=cur===total-1;}
    if(prev)prev.addEventListener('click',function(){if(cur>0)go(cur-1)});
    if(next)next.addEventListener('click',function(){if(cur<total-1)go(cur+1)});
    go(0);
  });
}

/* Price Simulator */
function initSimulators(){
  document.querySelectorAll('.sim').forEach(function(sim){
    var priceInput=sim.querySelector('.sim-price');
    var downInput=sim.querySelector('.sim-down');
    var rateInput=sim.querySelector('.sim-rate');
    var yearInput=sim.querySelector('.sim-year');
    var resultEl=sim.querySelector('.sim-amount');
    var totalEl=sim.querySelector('.sim-total');
    if(!priceInput||!resultEl)return;

    function calc(){
      var price=parseFloat(priceInput.value)*10000||0;
      var downPct=parseFloat(downInput?downInput.value:20)||20;
      var rate=parseFloat(rateInput?rateInput.value:3.5)||3.5;
      var years=parseInt(yearInput?yearInput.value:30)||30;
      var loan=price*(1-downPct/100);
      var monthlyRate=rate/100/12;
      var n=years*12;
      var monthly=0;
      if(monthlyRate>0&&n>0){
        monthly=loan*monthlyRate*Math.pow(1+monthlyRate,n)/(Math.pow(1+monthlyRate,n)-1);
      }
      resultEl.textContent=Math.round(monthly).toLocaleString('ko-KR')+'원';
      if(totalEl)totalEl.textContent='총 대출금: '+(loan/10000).toFixed(0)+'만원 · 자기자금: '+((price-loan)/10000).toFixed(0)+'만원';
    }

    [priceInput,downInput,rateInput,yearInput].forEach(function(el){
      if(el)el.addEventListener('input',calc);
    });
    calc();
  });
}

/* Init */
function init(){initChecklists();initGalleries();initSimulators()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
