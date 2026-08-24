import { Injectable } from '@angular/core';
import { Project } from '../models/project.model';
import { Equipment } from '../models/equipment.model';
import { Expertise } from '../models/expertise.model';

@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  private projects: Project[] = [
    {
      id: 1,
      title: 'Réseau d\'assainissement - Sousse',
      category: 'hydraulic',
      location: 'Sousse, Tunisie',
      year: '2023',
      description:
        'Installation de 28 km de réseaux d\'assainissement pour la ville de Sousse, incluant des collecteurs principaux en PVC DN400 à DN800, 3 stations de relevage et la raccordement de 1 200 foyers.',
      client: 'ONAS (Office National de l\'Assainissement)',
      scope: 'Étude, fourniture, installation, essais et mise en service',
      imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=800&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=800&q=80',
        'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80'
      ]
    },
    {
      id: 2,
      title: 'Adduction d\'eau potable - Nabeul',
      category: 'hydraulic',
      location: 'Nabeul, Tunisie',
      year: '2022',
      description:
        'Réalisation d\'une conduite d\'adduction d\'eau potable en fonte ductile DN600 sur 15 km entre le barrage et la station de traitement de Nabeul. Travaux incluant les regards de purge et de vidange.',
      client: 'SONEDE (Société Nationale d\'Exploitation et de Distribution des Eaux)',
      scope: 'Conception, fourniture, pose et essais hydrauliques',
      imageUrl: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80'
      ]
    },
    {
      id: 3,
      title: 'Station de dessalement - Djerba',
      category: 'hydraulic',
      location: 'Djerba, Tunisie',
      year: '2024',
      description:
        'Construction d\'une station de dessalement par osmose inverse d\'une capacité de 50 000 m³/jour incluant la prise d\'eau de mer, le prétraitement, les membranes RO, le post-traitement et 10 km de conduite de refoulement.',
      client: 'Ministère de l\'Agriculture et des Ressources Hydrauliques',
      scope: 'Contrat EPC — ingénierie, approvisionnement, construction',
      imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80'
      ]
    },
    {
      id: 4,
      title: 'Zone industrielle - Mégrine',
      category: 'construction',
      location: 'Mégrine, Grand Tunis, Tunisie',
      year: '2023',
      description:
        'Aménagement d\'une zone industrielle de 45 hectares incluant terrassement, réseaux VRD, assainissement pluvial, éclairage public et construction de 10 hangars pour PME industrielles.',
      client: 'Agence Foncière Industrielle (AFI)',
      scope: 'Plan d\'aménagement, conception VRD, construction',
      imageUrl: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=800&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=800&q=80'
      ]
    },
    {
      id: 5,
      title: 'Siège administratif - Tunis',
      category: 'construction',
      location: 'Tunis, Tunisie',
      year: '2024',
      description:
        'Construction d\'un immeuble de bureaux R+6 avec 2 niveaux de sous-sol, structure en béton armé, façade en mur-rideau et systèmes de building intelligents. Surface totale : 8 500 m².',
      client: 'Promotion Immobilière Maghrébine',
      scope: 'Études d\'exécution, fondations, superstructure, second œuvre',
      imageUrl: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80'
      ]
    },
    {
      id: 6,
      title: 'Pont-canal - Béja',
      category: 'construction',
      location: 'Béja, Tunisie',
      year: '2022',
      description:
        'Conception et réalisation d\'un pont-canal de 180 m pour le franchissement de l\'oued Béja par une conduite d\'irrigation DN800, avec culées en béton armé et appuis intermédiaires.',
      client: 'Ministère de l\'Équipement et de l\'Habitat',
      scope: 'Avant-projet, études d\'exécution, construction, essais de charge',
      imageUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800&q=80'
      ]
    }
  ];

  private equipment: Equipment[] = [
    {
      id: 1,
      name: 'Caterpillar 336 Excavator',
      type: 'Excavator',
      specs: '36-tonne, 2.0m³ bucket, 320 HP',
      quantity: 5,
      imageUrl: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80'
    },
    {
      id: 2,
      name: 'Komatsu D375A Bulldozer',
      type: 'Bulldozer',
      specs: '75-tonne, semi-U blade, 525 HP',
      quantity: 4,
      imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=800&q=80'
    },
    {
      id: 3,
      name: 'Liebherr LTM 1050 Crane',
      type: 'Crane',
      specs: '50-tonne capacity, 50m boom length',
      quantity: 2,
      imageUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800&q=80'
    },
    {
      id: 4,
      name: 'Caterpillar PL72 Pipe Layer',
      type: 'Pipe Layer',
      specs: '70-tonne, side boom, 48-inch pipe capacity',
      quantity: 3,
      imageUrl: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80'
    },
    {
      id: 5,
      name: 'Lincoln DC-1500 Welding Machine',
      type: 'Welding Machine',
      specs: '1500A DC output, dual-operator, diesel',
      quantity: 8,
      imageUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80'
    },
    {
      id: 6,
      name: 'Sany HZS180 Concrete Plant',
      type: 'Concrete Mixer',
      specs: '180 m³/hour capacity, twin-shaft mixer',
      quantity: 6,
      imageUrl: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=800&q=80'
    }
  ];

  private expertiseList: Expertise[] = [
    {
      id: 1,
      title: 'Hydraulic Engineering',
      description:
        'Design and construction of dams, water treatment plants, and irrigation systems for sustainable water management.',
      iconClass: 'fa-solid fa-water',
      details: [
        'Dam design and construction',
        'Water treatment plants',
        'Irrigation networks',
        'Desalination facilities',
        'Flood control systems'
      ]
    },
    {
      id: 2,
      title: 'Pipeline Solutions',
      description:
        'Cross-country pipeline installation for oil, gas, and water transmission with advanced welding and coating technologies.',
      iconClass: 'fa-solid fa-pipe-valve',
      details: [
        'Oil & gas pipelines',
        'Water transmission mains',
        'Pipeline welding (SMAW, GMAW, FCAW)',
        'Cathodic protection',
        'Hydrostatic testing'
      ]
    },
    {
      id: 3,
      title: 'Civil Engineering',
      description:
        'Industrial foundations, roads, bridges, and earthworks executed to the highest international standards.',
      iconClass: 'fa-solid fa-building',
      details: [
        'Industrial foundations',
        'Roads and highways',
        'Bridges and viaducts',
        'Earthworks and site preparation',
        'Retaining structures'
      ]
    },
    {
      id: 4,
      title: 'General Construction',
      description:
        'Turnkey construction services from site preparation through final handover for commercial and industrial facilities.',
      iconClass: 'fa-solid fa-hard-hat',
      details: [
        'Commercial buildings',
        'Industrial facilities',
        'Warehouses and logistics centers',
        'Renovation and rehabilitation',
        'Project management'
      ]
    }
  ];

  getProjects(): Project[] {
    return [...this.projects];
  }

  getProjectById(id: number): Project | undefined {
    return this.projects.find(p => p.id === id);
  }

  getProjectsByCategory(category: Project['category']): Project[] {
    return this.projects.filter(p => p.category === category);
  }

  getEquipment(): Equipment[] {
    return [...this.equipment];
  }

  getEquipmentByType(type: string): Equipment[] {
    return this.equipment.filter(e => e.type === type);
  }

  getExpertise(): Expertise[] {
    return [...this.expertiseList];
  }

  getExpertiseById(id: number): Expertise | undefined {
    return this.expertiseList.find(e => e.id === id);
  }
}
