window.Treino = window.Treino || {};

Treino.DAYS = [
  { slug: "seg", label: "Seg", full: "Segunda - Push", exercises: [
    { name: "Desenvolvimento com halteres", sets: ["15","10","8","6 a 8","6 a 8"] },
    { name: "Crucifixo reto na máquina", sets: ["15","10","8","6 a 8","6 a 8"] },
    { name: "Elevação lateral", sets: ["10","8","6 a 8","6 a 8"] },
    { name: "Supino inclinado", sets: ["10","8","6 a 8","6 a 8"] },
    { name: "Tríceps francês", sets: ["15","8","6 a 8"] },
    { name: "Elevação frontal", sets: ["10","8","8"] },
    { name: "Tríceps pulley", sets: ["10","8","8"] }
  ]},
  { slug: "ter", label: "Ter", full: "Terça - Pull", exercises: [
    { name: "Bíceps no banco scott", sets: ["15","10","8","6 a 8","6 a 8"] },
    { name: "Puxada alta com barra H", sets: ["15","10","8","6 a 8","6 a 8"] },
    { name: "Bíceps rosca direta no banco inclinado", sets: ["10","8","6 a 8"] },
    { name: "Remada na máquina (pegada aberta)", sets: ["10","8","6 a 8"] },
    { name: "Bíceps martelo com corda na polia", sets: ["8","6 a 8"] },
    { name: "Pull down", sets: ["8","6 a 8"] }
  ]},
  { slug: "qua", label: "Qua", full: "Quarta - Legs", exercises: [
    { name: "Cadeira extensora", sets: ["15","10","8","6 a 8","6 a 8"] },
    { name: "Cadeira flexora", sets: ["15","10","8","6 a 8","6 a 8"] },
    { name: "Agachamento no smith", sets: ["10","8","6 a 8","6 a 8"] },
    { name: "Cadeira abdutora", sets: ["10","8","6 a 8","6 a 8"] },
    { name: "Leg press", sets: ["8"] },
    { name: "Panturrilha no leg", sets: ["10","8","6 a 8","6 a 8"] }
  ]},
  { slug: "qui", label: "Qui", full: "Quinta - Upper", exercises: [
    { name: "Bíceps martelo", sets: ["15","10","8","6 a 8","6 a 8"], ref: "Referência: 21-27-33-39kg" },
    { name: "Remada cavalinho na máquina", sets: ["15","10","8","6 a 8","6 a 8"], ref: "Referência: 15-25-30-35kg" },
    { name: "Bíceps unilateral na polia", sets: ["10","8","6 a 8","6 a 8"], ref: "Referência: 9-15-18kg" },
    { name: "Supino reto", sets: ["10","8","6 a 8","6 a 8"], ref: "Referência: 10-15-17kg" },
    { name: "Tríceps na paralela", sets: ["10","6 a 8","6 a 8"], ref: "Referência: 3-3-4 reps" },
    { name: "Elevação lateral", sets: ["10","6 a 10","6 a 10"], ref: "Referência: 7-9kg" },
    { name: "Desenvolvimento na máquina", sets: ["10","6 a 10","6 a 10"], ref: "Referência: 10-15kg" }
  ]},
  { slug: "sex", label: "Sex", full: "Sexta - Lower", exercises: [
    { name: "Cadeira flexora", sets: ["15","10","8","6 a 8","6 a 8"] },
    { name: "Cadeira extensora", sets: ["15","10","8","6 a 8","6 a 8"] },
    { name: "Stiff", sets: ["10","8","6 a 8","6 a 8"] },
    { name: "Cadeira adutora", sets: ["10","8","6 a 8","6 a 8"] },
    { name: "Mesa flexora", sets: ["10","6 a 8"] },
    { name: "Panturrilha no smith", sets: ["10","8","6 a 8","6 a 8"] }
  ]}
];

// ---- IDs estáveis por exercício/série ----
//
// Cada exercício e cada série passa a ter um "id" próprio, em vez de o
// histórico depender da posição (índice) dentro da lista. Isso é o que
// permite reordenar ou remover algo no meio da lista sem "trocar" a carga
// de um exercício/série por engano.
//
// Para os dias padrão (aqui embaixo) e para edições antigas salvas antes
// desse recurso existir (ver edit.js), os ids são gerados de forma
// determinística a partir da posição, na primeira vez que a estrutura é
// carregada: "{slug}_ex{i}" para o exercício e "s{j}" para a série (única
// dentro do exercício; a chave de histórico usa "idExercicio_idSerie", ver
// history.js). Isso casa exatamente com o índice posicional que o
// histórico antigo usava, então a migração consegue mapear
// "exIdx_setIdx" -> "idExercicio_idSerie" sem perder nada. A partir daí, o
// id gerado é salvo e preservado nas cópias/edições (não é recalculado pela
// posição de novo), então continua estável mesmo se a lista for reordenada
// depois.
Treino.ensureIds = function(day, slug){
  if(!day || !day.exercises) return day;
  day.exercises.forEach(function(ex, i){
    if(!ex.id) ex.id = slug + "_ex" + i;
    ex.sets = (ex.sets || []).map(function(s, j){
      if(typeof s === "string"){
        return { id: "s" + j, reps: s };
      }
      if(!s.id) s.id = "s" + j;
      return s;
    });
  });
  return day;
};

// Gera um id novo e único (não posicional) para exercícios/séries criados
// pelo usuário no editor (adicionar exercício / adicionar série).
Treino.makeId = function(prefix){
  return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
};

Treino.DAYS.forEach(function(d){ Treino.ensureIds(d, d.slug); });
