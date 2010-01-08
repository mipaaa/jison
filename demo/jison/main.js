var parser;

if(typeof console === 'undefined'){
    console = {};
    console.log = function(str){document.getElementById("out").value = uneval(str)};
}
var printOut = function(str){document.getElementById("out").value = JSON.stringify(str)};

$(function () {

    $("#process_btn").click(processGrammar);
    $("#parse_btn").click(runParser);

    $(".action, .state").live("click", function (ev){
      if (!$(ev.target).is("a"))
        $(this).toggleClass("open");
    });

    $(".action, .state").live("dblclick", function (ev){
        var row = this.className.match(/(row_[0-9]+)/)[1];
        $(this).hasClass("open") ?
          $("."+row).removeClass("open") :
          $("."+row).addClass("open");
        return false;
    });

    $("#examples").change(function(ev) {
      var file = this.options[this.selectedIndex].value;
      $(document.body).addClass("loading");
      $.get("examples/"+file+".json", function (data) {
        $("#grammar").val(data);
        $(document.body).removeClass("loading");
      });
    });

});

function processGrammar () {
    var type = $("#type")[0].options[$("#type")[0].selectedIndex].value || "slr";

    try {
        var cfg = JSON.parse($("#grammar").val());
    } catch(e) { return alert("Oops. Make sure your JSON is correct.\n"+e); }

    if (cfg.lex) $("#parsing").show();
    else $("#parsing").hide();

    parser = new Jison.Parser(cfg, {type: type,noDefaultResolve:true});
    if (parser.computeLookaheads)
      parser.computeLookaheads();

    $("#out").val('');

    nonterminalInfo(parser);
    productions(parser);

    if (type === 'll')
      llTable(parser);
    else 
      lrTable(parser);
}

function runParser () {
    if (!parser) processGrammer();
    printOut("Parsing...");
    var source = $("#source").val();
    try {
        printOut(parser.parse(source));
    } catch(e) {
        printOut(e.message || e);
    }
}

function nonterminalInfo (p){
    var out = ["<h3>Nonterminals</h3><dl>"];
    for(var nt in p.nonterminals){
        out.push("<dt>",nt,"</dt>");
        out.push("<dd>", "nullable: "+(p.nonterminals[nt].nullable ? 'Yes':'No')+"<br/>firsts: "+p.nonterminals[nt].first+"<br/>follows: "+p.nonterminals[nt].follows);
        out.push("<p>Productions: ");
        p.nonterminals[nt].productions.forEach(function (prod) {
                out.push('<a href="#prod_'+prod.id+'">'+prod.id+'</a>');
                });
        out.push("</p></dd>");
    }
    out.push("</dl>");
    $("#nonterminals").html(out.join("\n"));
}

function productions (p){
    var out = ['<ol start="0">'];
    p.productions.forEach(function (prod) {
            out.push("<li id='prod_"+prod.id+"'>", prod, "</li>");
            });
    out.push('</ol>');
    $("#productions").html("<h3>Productions</h3>"+out.join(""));
}


function printCell (cell){
    var out = cell.join(",");

    out += "<div class='details'>";
    for (var i=0;i<cell.length;i++)
        out += parser.productions[cell[i]]+"<br />"; 
    out += "</div>";

    return out;
}

function llTable (p){
    var out = ['<table border="1">','<tr>'];
    out.push('<td>','</td>');
    p.terminals.forEach(function(t){
      out.push('<td>',t,'</td>');
    });
    out.push('</tr>');

    for (var nt in  p.table){
      out.push('<tr><td>',nt,'</td>');
      p.terminals.forEach(function(t){
        var cell = p.table[nt][t];
        if(cell)
          out.push('<td id="cell_'+nt+'_'+t+'" class="cell_'+nt+' '+(cell.length>1? 'conflict':'')+' action">',printCell(cell),'</td>');
        else
          out.push('<td>&nbsp;</td>');
      });
      out.push('</tr>');
    }

    out.push('</table>');
    $("#table").html("<h3>LL(1) Parse Table</h3>"+out.join(""));
}

function printActionDetails (a, token) {
  var out = "<div class='details'>";

  for (var i=0;i<a.length;i++) {
    if (a[i][0] == 1) {
      var link = "<a href='#state_"+a[i][1]+"'>Go to state "+a[i][1]+"</a>";
      out += "- Shift "+token+" then "+link+"<br />";
    }
    else if (a[i][0] == 2) {
      var text = "- Reduce by "+a[i][1]+") "+parser.productions[a[i][1]];
      out += text+"<br />";
    }
  }
  return out+"</div>";
}

function printAction (a){
    var actions = {"1":"s", "2":"r","3":"a"};
    if (!a[0]) return '';
    var out = '',
      ary = [];

    for(var i=0;i<a.length;i++)
        ary.push('<span class="action_'+(actions[a[i][0]])+'">'+(actions[a[i][0]])+(a[i][1]||'')+'</span>');

    out += ary.join(',');

    return out;
}

function sym2int (sym){ return parser.symbols_[sym]; }

function lrTable (p){
    var actions = {"1":"s", "2":"r","3":"a"};
    var gs = p.symbols.slice(0).sort();
    var out = ['<table border="1">','<thead>','<tr>'];
    out.push('<th>&#8595;states','</th>');
    var ntout = [];
    gs.shift();
    gs.forEach(function(t){
      if (p.nonterminals[t])
      ntout.push('<th class="nonterm nt-'+t+'"">',t,'</th>');
      else
        out.push('<th>',t,'</th>');
    });
    out.push.apply(out, ntout);
    out.push('</tr>','</thead>');

    for (var i=0,state;i < p.table.length;i++){
      state=p.table[i];
      if (!state) continue;
      ntout = [];
      out.push('<tr><td class="row_'+i+' state" id="state_'+i+'">',i,'<div class="details">'+parser.states.item(i).join('<br />')+'</div></td>');
      gs.forEach(function(ts){
        var t = sym2int(ts);
        console.log(ts, t, state[t], state);

        if (p.nonterminals[ts]){
          if (typeof state[t] === 'number')
            ntout.push('<td class="nonterm nt-'+t+'"><a href="#state_'+state[t]+'">',state[t],'</a></td>');
          else 
            ntout.push('<td class="nonterm">&nbsp;</td>');
        } else if (state[t])
          out.push('<td id="act-'+i+'-'+t+'" class="row_'+i+' '+(state[t][0] == 3 ? "accept" : '')+' action">',printAction(state[t]),printActionDetails(state[t], t));
        else
          out.push('<td>&nbsp;</td>');
      });
      out.push.apply(out, ntout);
      out.push('</tr>');
    }

    out.push('</table>');

    $("#table").html("<h3>"+parser.type+" Parse Table</h3><p>Click cells to show details</p>"+out.join(""));

    p.resolutions.forEach(function (res){
      var r = res[2];
      var el = document.getElementById('act-'+res[0]+'-'+p.symbols_[res[1]]);
      if (r.bydefault) {
        el.className += ' conflict';
      }
      if (el)
        el.title += r.msg+"\n"+"("+r.s+", "+r.r+") -> "+r.action;
    });

}

