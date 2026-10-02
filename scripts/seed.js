// Remplit la base avec des données de démonstration (associations fictives).
const config = require('../src/config');
const { openDatabase } = require('../src/db');
const { createModels } = require('../src/models');
const { parseParisInput, parisDateKey } = require('../src/lib/time');

const PASSWORD = 'demo-troyes-2026';

function seed(db = openDatabase()) {
  const m = createModels(db, config);
  if (db.prepare('SELECT COUNT(*) AS n FROM associations').get().n > 0) {
    console.log('La base contient déjà des associations : rien n’a été créé.');
    return false;
  }

  const tx = db.transaction(() => {
    m.users.create({ email: 'admin@exemple.fr', password: PASSWORD, firstName: 'Admin', lastName: 'Plateforme', isStaff: true });
    const u = {};
    [['camille', 'Camille', 'Martin'], ['yanis', 'Yanis', 'Bernard'], ['lea', 'Léa', 'Petit'],
      ['hugo', 'Hugo', 'Robert'], ['ines', 'Inès', 'Richard'], ['tom', 'Tom', 'Durand'], ['sarah', 'Sarah', 'Lefèvre']]
      .forEach(([key, firstName, lastName]) => {
        u[key] = m.users.create({ email: `${key}@exemple.fr`, password: PASSWORD, firstName, lastName });
      });

    const blank = { description: '', email: '', phone: '', website: '', address: '' };
    const asso = (owner, data, validated = true) => m.associations.create({ ...blank, ...data }, owner.id, validated);

    const velo = asso(u.camille, { name: 'Troyes à Vélo', category: 'environnement', color: '#8fd6cf', short_description: 'Promouvoir le vélo au quotidien dans l’agglomération troyenne.', description: 'Ateliers de réparation participatifs, balades mensuelles, plaidoyer pour des aménagements cyclables.', email: 'contact@velo.exemple.fr', address: 'Quai des Comtes de Champagne' });
    const theatre = asso(u.yanis, { name: 'Compagnie des Remparts', category: 'culture', color: '#c9b3f0', short_description: 'Troupe de théâtre amateur et ateliers pour tous les âges.', email: 'bonjour@remparts.exemple.fr', website: 'https://remparts.exemple.fr' });
    const solidarite = asso(u.lea, { name: 'Solidarité Seine', category: 'social', color: '#f5c3a0', short_description: 'Aide alimentaire et accompagnement des familles.', phone: '03 25 00 00 00' });
    const foot = asso(u.hugo, { name: 'Étoile Sportive Saint-Julien', category: 'sport', color: '#9cc9f5', short_description: 'Club de football pour les 6–17 ans.' });
    const jardin = asso(u.ines, { name: 'Jardins Partagés du Vouldy', category: 'quartier', color: '#a9d99a', short_description: 'Potagers collectifs, ateliers compost et fêtes de quartier.' });
    const musique = asso(u.sarah, { name: 'Les Voix de Champagne', category: 'culture', color: '#f2afc1', short_description: 'Chorale ouverte à tous, sans audition.' });
    asso(u.tom, { name: 'Les Amis de la Médiathèque', category: 'culture', color: '#e8d77a', short_description: 'Club de lecture et rencontres d’auteurs.' }, false);

    const join = (user, a, role = 'member') => {
      m.memberships.request(user.id, a.id, '');
      const ms = m.memberships.get(user.id, a.id);
      m.memberships.approve(ms.id);
      if (role === 'admin') m.memberships.setRole(ms.id, 'admin');
    };
    join(u.tom, velo);
    join(u.ines, solidarite);
    join(u.sarah, theatre);
    m.memberships.request(u.yanis.id, jardin.id, 'J’habite le quartier et j’aimerais aider au jardin.');

    const today = parisDateKey();
    const at = (days, time) => {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return parseParisInput(`${d.toISOString().slice(0, 10)}T${time}`).toISOString();
    };
    const ev = (a, owner, data) => m.events.create({
      association_id: a.id, category: a.category, visibility: 'public', volunteers_needed: 0, material_needs: '', ...data,
    }, owner.id);

    const fete = ev(velo, u.camille, { title: 'Fête du vélo', start_at: at(9, '10:00'), end_at: at(9, '18:00'), location: 'Place de la Libération', description: 'Balade familiale le matin, atelier réparation et bourse aux vélos l’après-midi. Venez nombreux !', volunteers_needed: 8, material_needs: '2 barnums, 4 tables, une sono.' });
    ev(theatre, u.yanis, { title: 'Le Malade imaginaire', start_at: at(9, '15:00'), end_at: at(9, '17:00'), location: 'Théâtre de la Madeleine', description: 'Représentation de fin d’atelier de la troupe adulte.' });
    const collecte = ev(solidarite, u.lea, { title: 'Collecte alimentaire', start_at: at(16, '09:00'), end_at: at(16, '19:00'), location: 'Galerie marchande, centre-ville', description: 'Grande collecte annuelle : nous avons besoin de bras pour l’accueil et le tri.', volunteers_needed: 12 });
    ev(foot, u.hugo, { title: 'Tournoi inter-quartiers U12', start_at: at(23, '09:00'), end_at: at(23, '17:00'), location: 'Stade de l’Aube', description: 'Tournoi amical, buvette sur place.' });
    ev(jardin, u.ines, { title: 'Atelier compost', start_at: at(4, '14:00'), end_at: at(4, '16:00'), location: 'Jardin du Vouldy', description: 'Apprenez à faire votre compost, repartez avec un bioseau.' });
    ev(musique, u.sarah, { title: 'Concert d’automne', start_at: at(12, '20:00'), end_at: at(12, '22:00'), location: 'Église Saint-Pantaléon', description: 'Programme : chants traditionnels et pièces contemporaines.' });
    ev(velo, u.camille, { title: 'Réunion inter-associations : forum de rentrée', start_at: at(30, '18:00'), end_at: at(30, '20:00'), location: 'Maison des associations', visibility: 'network', category: 'autre', description: 'Préparation commune du forum : stands, planning, communication.' });
    ev(theatre, u.yanis, { title: 'Atelier impro ados', start_at: at(2, '17:00'), end_at: at(2, '19:00'), location: 'Salle des Remparts', description: 'Séance découverte gratuite.' });

    m.events.addParticipation(fete, jardin.id, 'participant', 'On tient un stand semis et compost.', u.ines.id);
    m.events.addParticipation(fete, musique.id, 'support', 'La chorale chante à 16h !', u.sarah.id);
    m.events.addParticipation(collecte, foot.id, 'support', 'Les parents du club viennent en renfort.', u.hugo.id);
    m.events.toggleVolunteer(fete, u.tom.id);
    m.events.toggleVolunteer(fete, u.sarah.id);
    m.events.toggleVolunteer(collecte, u.ines.id);
    m.events.addComment(fete, u.yanis.id, 'On joue l’après-midi à la Madeleine, on peut faire une annonce croisée ?');
    m.events.addComment(fete, u.camille.id, 'Avec plaisir ! On annonce votre spectacle au micro.');

    const p = m.posts.create({ association_id: theatre.id, kind: 'lend', title: 'Prêt de projecteurs de scène', body: 'Nous avons 6 projecteurs LED disponibles en prêt les week-ends. Contactez-nous !' }, u.yanis.id);
    m.posts.addReply(p, u.camille.id, velo.id, 'Super, on serait intéressés pour la fête du vélo !');
    m.posts.create({ association_id: solidarite.id, kind: 'volunteers', title: 'Bénévoles pour la collecte de novembre', body: 'Nous cherchons des créneaux de 2h, même ponctuellement. Aucune compétence requise.' }, u.lea.id);
    m.posts.create({ association_id: jardin.id, kind: 'borrow', title: 'Recherche broyeur de végétaux', body: 'Pour un atelier compost, une demi-journée.' }, u.ines.id);
    m.posts.create({ association_id: musique.id, kind: 'space', title: 'Salle de répétition dispo le mardi', body: 'Notre salle est libre le mardi soir, 40 m², piano droit.' }, u.sarah.id);
  });
  tx();
  console.log(`Données de démo créées.\nComptes : admin@exemple.fr (modérateur), camille@exemple.fr, yanis@exemple.fr, lea@exemple.fr…\nMot de passe : ${PASSWORD}`);
  return true;
}

if (require.main === module) seed();
module.exports = { seed };
