// Generator: writes Faq namespace into the 6 placeholder bundles.
// FAQ tone is the calmest in the bundle — conversational, gentle,
// short answers. UK crisis services preserved verbatim.

import { readFileSync, writeFileSync } from 'node:fs';

const LOCALES = ['fr', 'de', 'es', 'it', 'pl', 'pt'];

const FAQ = {
  fr: {
    pageTitle: 'Questions fréquentes',
    metaTitle: 'FAQ — MindReset',
    metaDescription: 'Questions courantes sur MindReset, MiniMind, les tarifs, la confidentialité et le contact.',
    items: {
      whatIsMindReset: {
        question: "Qu'est-ce que MindReset ?",
        answer: "MindReset est un espace d'auto-soutien. C'est un endroit calme pour réfléchir, observer où vous en êtes, et choisir la suite, à votre rythme. Ce n'est pas une thérapie, ni du counselling, ni un soin médical.",
      },
      isTherapy: {
        question: 'MindReset est-il une thérapie ?',
        answer: "Non. MindReset n'est pas une thérapie, ni du counselling, ni un diagnostic, ni un traitement, et il ne remplace pas une aide professionnelle. Si vous avez besoin d'un soutien clinique, parlez-en à un médecin ou à un professionnel qualifié.",
      },
      whatIsMiniMind: {
        question: "Qu'est-ce que MiniMind ?",
        answer: "MiniMind est votre compagnon quotidien à l'intérieur de MindReset. Vous pouvez l'utiliser pour réfléchir, mettre des choses en mots, et retrouver un peu de stabilité. Vous dites autant ou aussi peu que vous le souhaitez, et il répond à ce que vous partagez.",
      },
      howToStart: {
        question: 'Comment commencer ?',
        answer: "Ouvrez MiniMind et commencez à écrire dès que vous êtes prêt. Il n'y a rien à configurer et aucune manière correcte de commencer — même quelques minutes suffisent.",
      },
      voiceInput: {
        question: 'Puis-je parler plutôt que taper ?',
        answer: 'Oui. Vous pouvez écrire ou parler à MiniMind — selon ce qui est plus facile. Si vous parlez, vos mots sont transformés en texte pour que vous puissiez les relire et les modifier avant de les envoyer. Vous pouvez passer du texte à la voix à tout moment.',
      },
      isItFree: {
        question: 'Est-ce gratuit ?',
        answer: "Vous commencez avec 50 messages gratuits, sans avoir besoin de saisir une carte. Il n'y a pas de limite de temps, vous pouvez donc les utiliser quand le moment compte.",
      },
      afterFreeMessages: {
        question: 'Que se passe-t-il après mes 50 messages gratuits ?',
        answer: "Si vous souhaitez continuer, vous pouvez choisir un abonnement — Essential ou Extended — ou ajouter un complément ponctuel. Il n'y a aucune pression à choisir, et rien ne se déclenche automatiquement.",
      },
      essentialVsExtended: {
        question: 'Quelle est la différence entre Essential et Extended ?',
        answer: "Les deux formules offrent des allocations mensuelles de messages différentes. Vous pouvez voir les détails actuels, les tarifs, et changer de formule à tout moment depuis votre page Compte.",
      },
      whatIsTopUp: {
        question: "Qu'est-ce qu'un complément ?",
        answer: "Un complément ajoute 200 messages supplémentaires en une fois, en plus de votre formule actuelle. C'est entièrement optionnel et vous ne serez jamais débité automatiquement pour cela.",
      },
      willIBeCharged: {
        question: 'Serai-je débité automatiquement ?',
        answer: "Les abonnements se renouvellent à un rythme régulier jusqu'à votre annulation, et vous êtes toujours informé avant un renouvellement. Les compléments sont ponctuels et ne sont jamais débités automatiquement. Vous pouvez annuler un abonnement à tout moment.",
      },
      howToCancel: {
        question: 'Comment puis-je annuler mon abonnement ?',
        answer: "Vous pouvez annuler à tout moment depuis votre page Compte. Vous conserverez l'accès jusqu'à la fin de la période déjà payée, et vous ne serez plus débité ensuite.",
      },
      isPrivate: {
        question: 'Mes informations sont-elles privées ?',
        answer: "Oui. Nous collectons le minimum — ni nom, ni adresse ne sont requis pour utiliser MiniMind. Vos conversations sont stockées en privé et protégées conformément à la loi britannique sur la protection des données.",
      },
      whoCanSee: {
        question: 'Qui peut voir mes conversations ?',
        answer: "Vos conversations vous appartiennent. Elles sont stockées en privé pour que vous soyez le seul à pouvoir y accéder via votre compte, et elles ne sont jamais partagées ni vendues.",
      },
      retention: {
        question: 'Combien de temps conservez-vous mes conversations ?',
        answer: "Vos messages sont conservés pendant 12 mois maximum à compter de votre dernière activité, après quoi ils sont automatiquement supprimés. Vous pouvez aussi les supprimer vous-même à tout moment. Nous conservons également un bref résumé des schémas que vous partagez, utilisé pour personnaliser votre expérience entre les sessions, tant que votre compte reste ouvert.",
      },
      canDelete: {
        question: 'Puis-je supprimer mes données ?',
        answer: "Oui. Vous pouvez supprimer vos conversations à tout moment depuis les paramètres de votre compte, et vous pouvez supprimer votre compte ainsi que toutes les données associées — y compris votre résumé sauvegardé — quand vous le souhaitez. Après une demande de suppression, vos données sont effacées définitivement dans les 30 jours. Vous pouvez aussi nous écrire à support@mindreset.ai pour vous aider.",
      },
      medicalAdvice: {
        question: 'MiniMind peut-il donner des conseils médicaux ou de santé mentale ?',
        answer: "Non. MiniMind ne diagnostique pas, ne traite pas et ne donne pas de conseils médicaux ou cliniques. C'est un espace de réflexion personnelle. Pour tout sujet clinique, adressez-vous à un professionnel qualifié.",
      },
      crisisHelp: {
        question: 'Que faire si je suis en crise ou en danger ?',
        answer: "MindReset n'est pas un service de crise. Si vous êtes en danger immédiat, appelez les services d'urgence locaux (999 au Royaume-Uni). Si vous traversez un moment difficile et avez besoin de parler à quelqu'un maintenant, vous pouvez appeler Samaritans gratuitement au 116 123 (Royaume-Uni), à toute heure, jour et nuit.",
      },
      ageRequirement: {
        question: "Y a-t-il un âge requis pour utiliser MindReset ?",
        answer: 'Oui. MindReset est destiné aux adultes de 18 ans et plus.',
      },
      languages: {
        question: 'Quelles langues sont prises en charge par MindReset ?',
        answer: "MindReset est disponible dans plusieurs langues, l'anglais et le russe étant nos langues principales. Vous pouvez changer de langue depuis les paramètres de votre compte.",
      },
      mobileUse: {
        question: 'Puis-je utiliser MindReset sur mon téléphone ?',
        answer: "Oui. MindReset fonctionne dans le navigateur web de votre téléphone comme sur un ordinateur — il n'y a rien à installer.",
      },
      contact: {
        question: 'Comment vous contacter ?',
        answer: "Vous pouvez nous écrire à support@mindreset.ai. Nous ferons de notre mieux pour vous répondre, mais souvenez-vous que nous ne sommes pas un service de crise — pour une aide urgente, utilisez les contacts de la question précédente sur la crise.",
      },
    },
  },

  de: {
    pageTitle: 'Häufig gestellte Fragen',
    metaTitle: 'FAQ — MindReset',
    metaDescription: 'Häufige Fragen zu MindReset, MiniMind, Preisen, Datenschutz und Kontakt.',
    items: {
      whatIsMindReset: {
        question: 'Was ist MindReset?',
        answer: 'MindReset ist ein Raum für Selbsthilfe. Ein stiller Ort, um nachzudenken, wahrzunehmen, wo Sie stehen, und zu wählen, was als Nächstes kommt — in Ihrem eigenen Tempo. Es ist keine Therapie, keine Beratung und keine medizinische Versorgung.',
      },
      isTherapy: {
        question: 'Ist MindReset eine Therapie?',
        answer: 'Nein. MindReset ist keine Therapie, keine Beratung, keine Diagnostik und keine Behandlung und kein Ersatz für professionelle Hilfe. Wenn Sie klinische Unterstützung brauchen, wenden Sie sich bitte an einen Arzt oder eine qualifizierte Fachperson.',
      },
      whatIsMiniMind: {
        question: 'Was ist MiniMind?',
        answer: 'MiniMind ist Ihre tägliche Begleitung innerhalb von MindReset. Sie können es nutzen, um nachzudenken, Dinge auszusprechen und ein wenig Halt zu finden. Sie sagen so viel oder so wenig, wie Sie möchten, und es reagiert auf das, was Sie teilen.',
      },
      howToStart: {
        question: 'Wie fange ich an?',
        answer: 'Öffnen Sie MiniMind und beginnen Sie zu schreiben, wann immer Sie bereit sind. Es gibt nichts einzurichten und keinen richtigen Weg zu beginnen — schon ein paar Minuten genügen.',
      },
      voiceInput: {
        question: 'Kann ich sprechen statt zu tippen?',
        answer: 'Ja. Sie können MiniMind tippen oder sprechen — was Ihnen leichter fällt. Wenn Sie sprechen, werden Ihre Worte in Text umgewandelt, damit Sie sie lesen und vor dem Senden bearbeiten können. Sie können jederzeit zwischen Tippen und Sprechen wechseln.',
      },
      isItFree: {
        question: 'Ist es kostenlos?',
        answer: 'Sie beginnen mit 50 kostenlosen Nachrichten, ohne eine Karte hinterlegen zu müssen. Es gibt keine Zeitbegrenzung, Sie können sie also nutzen, wann immer der Moment zählt.',
      },
      afterFreeMessages: {
        question: 'Was passiert nach meinen 50 kostenlosen Nachrichten?',
        answer: 'Wenn Sie weitermachen möchten, können Sie ein Abonnement wählen — Essential oder Extended — oder ein einmaliges Top-up hinzufügen. Es gibt keinen Druck zu wählen, und nichts geschieht automatisch.',
      },
      essentialVsExtended: {
        question: 'Worin unterscheiden sich Essential und Extended?',
        answer: 'Die beiden Tarife bieten unterschiedliche monatliche Nachrichtenkontingente. Aktuelle Details, Preise und einen Tarifwechsel können Sie jederzeit auf Ihrer Konto-Seite einsehen.',
      },
      whatIsTopUp: {
        question: 'Was ist ein Top-up?',
        answer: 'Ein Top-up fügt einmalig 200 zusätzliche Nachrichten zu Ihrem aktuellen Tarif hinzu. Es ist völlig optional, und es wird Ihnen nie automatisch in Rechnung gestellt.',
      },
      willIBeCharged: {
        question: 'Werde ich automatisch abgebucht?',
        answer: 'Abonnements verlängern sich in regelmäßigen Zyklen, bis Sie kündigen, und Sie werden vor jeder Verlängerung informiert. Top-ups sind einmalig und werden nie automatisch abgebucht. Sie können ein Abonnement jederzeit kündigen.',
      },
      howToCancel: {
        question: 'Wie kündige ich mein Abonnement?',
        answer: 'Sie können jederzeit auf Ihrer Konto-Seite kündigen. Sie behalten den Zugang bis zum Ende des bereits bezahlten Zeitraums, und danach wird Ihnen nichts mehr in Rechnung gestellt.',
      },
      isPrivate: {
        question: 'Sind meine Informationen privat?',
        answer: 'Ja. Wir erheben so wenig wie möglich — weder Name noch Adresse sind erforderlich, um MiniMind zu nutzen. Ihre Gespräche werden privat gespeichert und im Einklang mit dem britischen Datenschutzrecht geschützt.',
      },
      whoCanSee: {
        question: 'Wer kann meine Gespräche sehen?',
        answer: 'Ihre Gespräche gehören Ihnen. Sie werden privat gespeichert, sodass nur Sie über Ihr Konto darauf zugreifen können, und sie werden niemals geteilt oder verkauft.',
      },
      retention: {
        question: 'Wie lange werden meine Gespräche gespeichert?',
        answer: 'Ihre Nachrichten werden bis zu 12 Monate ab Ihrer letzten Aktivität aufbewahrt und danach automatisch gelöscht. Sie können sie auch jederzeit selbst früher löschen. Wir bewahren zudem eine kurze Zusammenfassung der Muster, die Sie teilen, auf — sie dient dazu, Ihre Erfahrung über Sitzungen hinweg zu personalisieren — solange Ihr Konto besteht.',
      },
      canDelete: {
        question: 'Kann ich meine Daten löschen?',
        answer: 'Ja. Sie können Ihre Gespräche jederzeit in den Kontoeinstellungen löschen und Ihr Konto samt aller zugehörigen Daten — einschließlich Ihrer gespeicherten Zusammenfassung — wann immer Sie möchten. Nach einer Löschanfrage werden Ihre Daten innerhalb von 30 Tagen endgültig gelöscht. Sie können uns auch unter support@mindreset.ai um Hilfe bitten.',
      },
      medicalAdvice: {
        question: 'Kann MiniMind medizinische oder psychologische Ratschläge geben?',
        answer: 'Nein. MiniMind diagnostiziert nicht, behandelt nicht und gibt keine medizinischen oder klinischen Ratschläge. Es ist ein Raum für Selbstreflexion. Für alles Klinische wenden Sie sich bitte an eine qualifizierte Fachperson.',
      },
      crisisHelp: {
        question: 'Was tue ich, wenn ich in einer Krise bin oder mich unsicher fühle?',
        answer: 'MindReset ist kein Krisendienst. Wenn Sie in unmittelbarer Gefahr sind, rufen Sie Ihren örtlichen Notdienst an (999 im Vereinigten Königreich). Wenn Sie ringen und gerade jetzt jemanden zum Sprechen brauchen, können Sie Samaritans kostenlos unter 116 123 (UK) anrufen — jederzeit, Tag und Nacht.',
      },
      ageRequirement: {
        question: 'Gibt es ein Mindestalter für MindReset?',
        answer: 'Ja. MindReset ist für Erwachsene ab 18 Jahren.',
      },
      languages: {
        question: 'Welche Sprachen unterstützt MindReset?',
        answer: 'MindReset ist in mehreren Sprachen verfügbar, mit Englisch und Russisch als unseren Hauptsprachen. Sie können die Sprache in den Kontoeinstellungen wechseln.',
      },
      mobileUse: {
        question: 'Kann ich MindReset auf dem Handy nutzen?',
        answer: 'Ja. MindReset funktioniert im Webbrowser Ihres Handys ebenso wie am Computer — es muss nichts installiert werden.',
      },
      contact: {
        question: 'Wie kann ich Sie kontaktieren?',
        answer: 'Sie erreichen uns unter support@mindreset.ai. Wir tun unser Bestes, um zu antworten — bitte denken Sie aber daran, dass wir kein Krisendienst sind. Für dringende Hilfe nutzen Sie die Kontakte in der vorherigen Krisen-Frage.',
      },
    },
  },

  es: {
    pageTitle: 'Preguntas frecuentes',
    metaTitle: 'FAQ — MindReset',
    metaDescription: 'Preguntas habituales sobre MindReset, MiniMind, precios, privacidad y contacto.',
    items: {
      whatIsMindReset: {
        question: '¿Qué es MindReset?',
        answer: 'MindReset es un espacio de auto-ayuda. Un lugar tranquilo para reflexionar, notar dónde está y elegir lo que viene a continuación, a su propio ritmo. No es terapia, ni counselling, ni atención médica.',
      },
      isTherapy: {
        question: '¿MindReset es terapia?',
        answer: 'No. MindReset no es terapia, ni counselling, ni diagnóstico, ni tratamiento, y no sustituye la ayuda profesional. Si necesita apoyo clínico, hable con un médico o un profesional cualificado.',
      },
      whatIsMiniMind: {
        question: '¿Qué es MiniMind?',
        answer: 'MiniMind es su compañero diario dentro de MindReset. Puede utilizarlo para reflexionar, hablar de las cosas y encontrar un poco de estabilidad. Usted dice lo que quiere, mucho o poco, y él responde a lo que comparte.',
      },
      howToStart: {
        question: '¿Cómo empiezo?',
        answer: 'Abra MiniMind y comience a escribir cuando se sienta listo. No hay nada que configurar y no hay una forma correcta de empezar — incluso unos minutos son suficientes.',
      },
      voiceInput: {
        question: '¿Puedo hablar en lugar de escribir?',
        answer: 'Sí. Puede escribir o hablar a MiniMind — lo que le resulte más fácil. Si habla, sus palabras se convierten en texto para que pueda releerlas y editarlas antes de enviarlas. Puede alternar entre texto y voz en cualquier momento.',
      },
      isItFree: {
        question: '¿Es gratuito?',
        answer: 'Empieza con 50 mensajes gratuitos y no necesita introducir una tarjeta para utilizarlos. No hay límite de tiempo, así que puede usarlos cuando el momento importe.',
      },
      afterFreeMessages: {
        question: '¿Qué ocurre después de mis 50 mensajes gratuitos?',
        answer: 'Si quiere continuar, puede elegir una suscripción — Essential o Extended — o añadir una recarga puntual. No hay presión para elegir y nada ocurre automáticamente.',
      },
      essentialVsExtended: {
        question: '¿Cuál es la diferencia entre Essential y Extended?',
        answer: 'Los dos planes ofrecen diferentes asignaciones mensuales de mensajes. Puede ver los detalles actuales, los precios, y cambiar de plan en cualquier momento desde su página de Cuenta.',
      },
      whatIsTopUp: {
        question: '¿Qué es una recarga?',
        answer: 'Una recarga añade 200 mensajes adicionales de una sola vez, encima del plan que tenga. Es completamente opcional y nunca se cobrará automáticamente.',
      },
      willIBeCharged: {
        question: '¿Se me cobrará automáticamente?',
        answer: 'Las suscripciones se renuevan a un ritmo regular hasta que las cancele, y siempre se le avisa antes de cada renovación. Las recargas son puntuales y nunca se cobran automáticamente. Puede cancelar una suscripción en cualquier momento.',
      },
      howToCancel: {
        question: '¿Cómo cancelo mi suscripción?',
        answer: 'Puede cancelar en cualquier momento desde su página de Cuenta. Mantendrá el acceso hasta el final del período ya pagado, y no se le cobrará de nuevo después.',
      },
      isPrivate: {
        question: '¿Es privada mi información?',
        answer: 'Sí. Recogemos lo mínimo posible — no se requiere nombre ni dirección para utilizar MiniMind. Sus conversaciones se almacenan de forma privada y están protegidas conforme a la ley británica de protección de datos.',
      },
      whoCanSee: {
        question: '¿Quién puede ver mis conversaciones?',
        answer: 'Sus conversaciones son suyas. Se almacenan de forma privada de modo que solo usted pueda acceder a ellas desde su cuenta, y nunca se comparten ni se venden.',
      },
      retention: {
        question: '¿Cuánto tiempo conservan mis conversaciones?',
        answer: 'Sus mensajes se conservan hasta 12 meses desde su última actividad, tras los cuales se eliminan automáticamente. También puede eliminarlos usted mismo antes en cualquier momento. Guardamos además un breve resumen de los patrones que comparte, usado para personalizar su experiencia entre sesiones, mientras su cuenta permanezca abierta.',
      },
      canDelete: {
        question: '¿Puedo eliminar mis datos?',
        answer: 'Sí. Puede eliminar sus conversaciones en cualquier momento desde los ajustes de su cuenta y puede eliminar su cuenta y todos los datos asociados — incluido su resumen guardado — cuando quiera. Tras una solicitud de eliminación, sus datos se borran de forma permanente en un plazo de 30 días. También puede escribirnos a support@mindreset.ai para que le ayudemos.',
      },
      medicalAdvice: {
        question: '¿MiniMind puede dar consejos médicos o de salud mental?',
        answer: 'No. MiniMind no diagnostica, no trata ni ofrece consejos médicos o clínicos. Es un espacio para la reflexión personal. Para cualquier tema clínico, hable con un profesional cualificado.',
      },
      crisisHelp: {
        question: '¿Qué hago si estoy en crisis o no me siento seguro?',
        answer: 'MindReset no es un servicio de crisis. Si está en peligro inmediato, llame a los servicios de emergencia locales (999 en el Reino Unido). Si lo está pasando mal y necesita hablar con alguien ahora, puede llamar gratis a Samaritans al 116 123 (Reino Unido), a cualquier hora, día o noche.',
      },
      ageRequirement: {
        question: '¿Hay una edad mínima para utilizar MindReset?',
        answer: 'Sí. MindReset es para personas adultas de 18 años en adelante.',
      },
      languages: {
        question: '¿Qué idiomas admite MindReset?',
        answer: 'MindReset está disponible en varios idiomas, siendo el inglés y el ruso nuestras lenguas principales. Puede cambiar de idioma desde los ajustes de su cuenta.',
      },
      mobileUse: {
        question: '¿Puedo usar MindReset en el móvil?',
        answer: 'Sí. MindReset funciona en el navegador web del móvil igual que en un ordenador — no hay nada que instalar.',
      },
      contact: {
        question: '¿Cómo puedo contactarles?',
        answer: 'Puede escribirnos a support@mindreset.ai. Haremos lo posible por responderle, pero recuerde que no somos un servicio de crisis — para ayuda urgente, utilice los contactos de la pregunta anterior sobre crisis.',
      },
    },
  },

  it: {
    pageTitle: 'Domande frequenti',
    metaTitle: 'FAQ — MindReset',
    metaDescription: 'Domande comuni su MindReset, MiniMind, prezzi, privacy e contatto.',
    items: {
      whatIsMindReset: {
        question: "Che cos'è MindReset?",
        answer: "MindReset è uno spazio di auto-aiuto. Un luogo tranquillo per riflettere, notare dove ci si trova e scegliere cosa viene dopo, al proprio ritmo. Non è terapia, né counselling, né cura medica.",
      },
      isTherapy: {
        question: 'MindReset è una terapia?',
        answer: "No. MindReset non è terapia, non è counselling, non è diagnosi né trattamento, e non sostituisce un aiuto professionale. Se Le serve un sostegno clinico, parli con un medico o con un professionista qualificato.",
      },
      whatIsMiniMind: {
        question: "Che cos'è MiniMind?",
        answer: "MiniMind è il Suo compagno quotidiano all'interno di MindReset. Può usarlo per riflettere, mettere in parole le cose, e ritrovare un po' di stabilità. Dice quanto o quanto poco vuole, e lui risponde a ciò che condivide.",
      },
      howToStart: {
        question: 'Come comincio?',
        answer: "Apra MiniMind e cominci a scrivere quando si sente pronto. Non c'è nulla da configurare e non esiste un modo giusto di iniziare — anche pochi minuti bastano.",
      },
      voiceInput: {
        question: 'Posso parlare invece di scrivere?',
        answer: "Sì. Può scrivere o parlare a MiniMind — quel che Le risulta più facile. Se parla, le Sue parole vengono trasformate in testo, così può rileggerle e modificarle prima di inviarle. Può alternare scrittura e voce in qualsiasi momento.",
      },
      isItFree: {
        question: 'È gratuito?',
        answer: "Inizia con 50 messaggi gratuiti, senza dover inserire una carta. Non c'è un limite di tempo, può usarli quando il momento conta.",
      },
      afterFreeMessages: {
        question: 'Cosa succede dopo i miei 50 messaggi gratuiti?',
        answer: "Se desidera continuare, può scegliere un abbonamento — Essential o Extended — oppure aggiungere una ricarica una tantum. Non c'è pressione a scegliere, e nulla avviene automaticamente.",
      },
      essentialVsExtended: {
        question: "Qual è la differenza tra Essential ed Extended?",
        answer: "I due piani offrono diversi quantitativi mensili di messaggi. Può vedere i dettagli aggiornati, i prezzi e cambiare piano in qualsiasi momento dalla pagina Account.",
      },
      whatIsTopUp: {
        question: "Che cos'è una ricarica?",
        answer: "Una ricarica aggiunge 200 messaggi in più una tantum, oltre al piano in corso. È del tutto facoltativa e non Le verrà mai addebitata automaticamente.",
      },
      willIBeCharged: {
        question: 'Mi verrà addebitato automaticamente?',
        answer: "Gli abbonamenti si rinnovano con cadenza regolare fino alla disdetta, e viene sempre avvisato prima di ogni rinnovo. Le ricariche sono una tantum e non vengono mai addebitate automaticamente. Può disdire un abbonamento in qualsiasi momento.",
      },
      howToCancel: {
        question: 'Come disdico il mio abbonamento?',
        answer: "Può disdire in qualsiasi momento dalla pagina Account. Manterrà l'accesso fino alla fine del periodo già pagato, e dopo non Le verrà più addebitato nulla.",
      },
      isPrivate: {
        question: 'Le mie informazioni sono private?',
        answer: "Sì. Raccogliamo il minimo possibile — non occorrono né nome né indirizzo per usare MiniMind. Le Sue conversazioni vengono archiviate in privato e sono protette in conformità con la legge britannica sulla protezione dei dati.",
      },
      whoCanSee: {
        question: 'Chi può vedere le mie conversazioni?',
        answer: "Le Sue conversazioni sono Sue. Sono archiviate in privato in modo che solo Lei possa accedervi dal Suo account, e non vengono mai condivise né vendute.",
      },
      retention: {
        question: 'Per quanto tempo conservate le mie conversazioni?',
        answer: "I Suoi messaggi vengono conservati fino a 12 mesi dall'ultima attività, dopodiché vengono cancellati automaticamente. Può cancellarli Lei stesso prima, in qualsiasi momento. Conserviamo inoltre un breve riepilogo degli schemi che condivide, usato per personalizzare l'esperienza tra le sessioni, finché il Suo account rimane aperto.",
      },
      canDelete: {
        question: 'Posso cancellare i miei dati?',
        answer: "Sì. Può cancellare le conversazioni in qualsiasi momento dalle impostazioni dell'account, e può cancellare l'account e tutti i dati associati — compreso il riepilogo salvato — quando vuole. Dopo una richiesta di cancellazione, i Suoi dati vengono cancellati definitivamente entro 30 giorni. Può anche scriverci a support@mindreset.ai per essere assistito.",
      },
      medicalAdvice: {
        question: 'MiniMind può dare consigli medici o di salute mentale?',
        answer: "No. MiniMind non diagnostica, non cura e non offre consigli medici o clinici. È uno spazio di riflessione personale. Per qualsiasi tema clinico, si rivolga a un professionista qualificato.",
      },
      crisisHelp: {
        question: 'Cosa faccio se sono in crisi o non mi sento al sicuro?',
        answer: "MindReset non è un servizio di crisi. Se è in pericolo immediato, chiami i servizi di emergenza locali (999 nel Regno Unito). Se sta attraversando un momento difficile e ha bisogno di parlare con qualcuno adesso, può chiamare gratuitamente Samaritans al 116 123 (Regno Unito), a qualsiasi ora, giorno e notte.",
      },
      ageRequirement: {
        question: "C'è un'età minima per usare MindReset?",
        answer: 'Sì. MindReset è per adulti dai 18 anni in su.',
      },
      languages: {
        question: 'Quali lingue supporta MindReset?',
        answer: "MindReset è disponibile in più lingue, con l'inglese e il russo come lingue principali. Può cambiare lingua dalle impostazioni del Suo account.",
      },
      mobileUse: {
        question: 'Posso usare MindReset dal telefono?',
        answer: "Sì. MindReset funziona nel browser web del telefono come da computer — non c'è nulla da installare.",
      },
      contact: {
        question: 'Come posso contattarvi?',
        answer: "Può scriverci a support@mindreset.ai. Faremo del nostro meglio per risponderLe — ma ricordi che non siamo un servizio di crisi. Per un aiuto urgente, usi i contatti della domanda precedente sulla crisi.",
      },
    },
  },

  pl: {
    pageTitle: 'Najczęściej zadawane pytania',
    metaTitle: 'FAQ — MindReset',
    metaDescription: 'Najczęstsze pytania o MindReset, MiniMind, ceny, prywatność i kontakt.',
    items: {
      whatIsMindReset: {
        question: 'Czym jest MindReset?',
        answer: 'MindReset to przestrzeń samopomocy. Spokojne miejsce, aby się zatrzymać, zauważyć, gdzie Pani jest, i wybrać, co dalej, we własnym tempie. To nie terapia, nie counselling i nie opieka medyczna.',
      },
      isTherapy: {
        question: 'Czy MindReset to terapia?',
        answer: 'Nie. MindReset nie jest terapią, counsellingiem, diagnozą ani leczeniem i nie zastępuje pomocy specjalistycznej. Jeśli potrzebuje Pani wsparcia klinicznego, proszę porozmawiać z lekarzem lub wykwalifikowanym specjalistą.',
      },
      whatIsMiniMind: {
        question: 'Czym jest MiniMind?',
        answer: 'MiniMind to Pani codzienny towarzysz w MindReset. Można z niego korzystać, by się zatrzymać, wypowiedzieć rzeczy i odzyskać odrobinę stabilności. Mówi Pani tyle, ile chce, a on odpowiada na to, czym Pani się dzieli.',
      },
      howToStart: {
        question: 'Jak zacząć?',
        answer: 'Proszę otworzyć MiniMind i zacząć pisać, kiedy będzie Pani gotowa. Nie ma nic do skonfigurowania ani jedynej słusznej drogi — kilka minut już wystarczy.',
      },
      voiceInput: {
        question: 'Czy mogę mówić zamiast pisać?',
        answer: 'Tak. Można pisać do MiniMind lub mówić — co jest wygodniejsze. Jeśli Pani mówi, słowa są zamieniane na tekst, by można je było przeczytać i poprawić przed wysłaniem. Można w każdej chwili przełączać się między pisaniem a mówieniem.',
      },
      isItFree: {
        question: 'Czy jest bezpłatnie?',
        answer: 'Zaczyna Pani od 50 bezpłatnych wiadomości i nie trzeba podawać karty, by z nich skorzystać. Nie ma limitu czasu, można ich użyć, kiedy moment ma znaczenie.',
      },
      afterFreeMessages: {
        question: 'Co się dzieje po wyczerpaniu 50 bezpłatnych wiadomości?',
        answer: 'Jeśli chce Pani kontynuować, można wybrać subskrypcję — Essential lub Extended — albo dodać jednorazowe doładowanie. Nie ma presji, by wybierać, i nic nie dzieje się automatycznie.',
      },
      essentialVsExtended: {
        question: 'Jaka jest różnica między Essential a Extended?',
        answer: 'Oba plany oferują różne miesięczne limity wiadomości. Aktualne szczegóły, ceny i zmianę planu można zobaczyć w dowolnej chwili na stronie Konto.',
      },
      whatIsTopUp: {
        question: 'Czym jest doładowanie?',
        answer: 'Doładowanie dodaje jednorazowo 200 dodatkowych wiadomości, niezależnie od posiadanego planu. Jest całkowicie opcjonalne i nigdy nie zostanie naliczone automatycznie.',
      },
      willIBeCharged: {
        question: 'Czy będę obciążana automatycznie?',
        answer: 'Subskrypcje odnawiają się w regularnych cyklach, aż do rezygnacji, a przed każdym odnowieniem otrzyma Pani powiadomienie. Doładowania są jednorazowe i nigdy nie są pobierane automatycznie. Subskrypcję można anulować w każdej chwili.',
      },
      howToCancel: {
        question: 'Jak anulować subskrypcję?',
        answer: 'Można anulować w dowolnym momencie ze strony Konto. Dostęp pozostaje do końca już opłaconego okresu, a po tym nie zostanie pobrana żadna opłata.',
      },
      isPrivate: {
        question: 'Czy moje informacje są prywatne?',
        answer: 'Tak. Zbieramy jak najmniej — do korzystania z MiniMind nie jest potrzebne ani imię, ani adres. Rozmowy są przechowywane prywatnie i chronione zgodnie z brytyjskim prawem o ochronie danych.',
      },
      whoCanSee: {
        question: 'Kto może zobaczyć moje rozmowy?',
        answer: 'Rozmowy należą do Pani. Są przechowywane prywatnie tak, by tylko Pani miała do nich dostęp przez swoje konto, i nigdy nie są udostępniane ani sprzedawane.',
      },
      retention: {
        question: 'Jak długo przechowujecie moje rozmowy?',
        answer: 'Wiadomości są przechowywane do 12 miesięcy od ostatniej aktywności, po czym są automatycznie usuwane. Można je też usunąć samodzielnie wcześniej, w dowolnej chwili. Przechowujemy także krótkie podsumowanie wzorców, którymi się Pani dzieli, używane do personalizacji doświadczenia między sesjami, dopóki konto jest aktywne.',
      },
      canDelete: {
        question: 'Czy mogę usunąć swoje dane?',
        answer: 'Tak. Można usunąć rozmowy w dowolnej chwili z ustawień konta, a także usunąć konto i wszystkie powiązane dane — włącznie z zapisanym podsumowaniem — kiedy Pani zechce. Po żądaniu usunięcia dane są trwale usuwane w ciągu 30 dni. Można też napisać do nas na support@mindreset.ai po pomoc.',
      },
      medicalAdvice: {
        question: 'Czy MiniMind może udzielać porad medycznych lub psychologicznych?',
        answer: 'Nie. MiniMind nie diagnozuje, nie leczy i nie udziela porad medycznych ani klinicznych. To przestrzeń do osobistej refleksji. W sprawach klinicznych proszę porozmawiać z wykwalifikowanym specjalistą.',
      },
      crisisHelp: {
        question: 'Co robić w sytuacji kryzysu lub poczucia zagrożenia?',
        answer: 'MindReset nie jest usługą kryzysową. W razie bezpośredniego zagrożenia proszę zadzwonić do lokalnych służb ratunkowych (999 w Wielkiej Brytanii). Jeśli przechodzi Pani przez trudny moment i potrzebuje porozmawiać z kimś teraz, można zadzwonić bezpłatnie do Samaritans pod 116 123 (UK), o każdej porze, dniem i nocą.',
      },
      ageRequirement: {
        question: 'Czy jest dolna granica wieku, by korzystać z MindReset?',
        answer: 'Tak. MindReset jest dla osób dorosłych, od 18 lat wzwyż.',
      },
      languages: {
        question: 'Jakie języki obsługuje MindReset?',
        answer: 'MindReset jest dostępny w kilku językach, a naszymi głównymi językami są angielski i rosyjski. Język można zmienić w ustawieniach konta.',
      },
      mobileUse: {
        question: 'Czy mogę korzystać z MindReset na telefonie?',
        answer: 'Tak. MindReset działa w przeglądarce telefonu tak samo jak na komputerze — niczego nie trzeba instalować.',
      },
      contact: {
        question: 'Jak się z Wami skontaktować?',
        answer: 'Można napisać do nas na support@mindreset.ai. Postaramy się odpowiedzieć — proszę jednak pamiętać, że nie jesteśmy usługą kryzysową. W pilnej potrzebie należy korzystać z kontaktów z poprzedniego pytania o kryzys.',
      },
    },
  },

  pt: {
    pageTitle: 'Perguntas frequentes',
    metaTitle: 'FAQ — MindReset',
    metaDescription: 'Perguntas comuns sobre MindReset, MiniMind, preços, privacidade e contacto.',
    items: {
      whatIsMindReset: {
        question: 'O que é MindReset?',
        answer: 'MindReset é um espaço de auto-ajuda. Um lugar tranquilo para reflectir, notar onde está e escolher o que vem a seguir, ao seu próprio ritmo. Não é terapia, nem aconselhamento, nem cuidado médico.',
      },
      isTherapy: {
        question: 'MindReset é terapia?',
        answer: 'Não. MindReset não é terapia, aconselhamento, diagnóstico ou tratamento, e não substitui ajuda profissional. Se precisar de apoio clínico, fale com um médico ou profissional qualificado.',
      },
      whatIsMiniMind: {
        question: 'O que é MiniMind?',
        answer: 'MiniMind é o seu companheiro diário dentro de MindReset. Pode usá-lo para reflectir, pôr em palavras as coisas e encontrar um pouco de firmeza. Diz tanto ou tão pouco quanto quiser, e ele responde ao que partilha.',
      },
      howToStart: {
        question: 'Como começo?',
        answer: 'Abra MiniMind e comece a escrever quando se sentir pronto. Não há nada para configurar e não existe uma forma certa de começar — mesmo alguns minutos chegam.',
      },
      voiceInput: {
        question: 'Posso falar em vez de escrever?',
        answer: 'Sim. Pode escrever ou falar com MiniMind — o que lhe for mais fácil. Se falar, as suas palavras passam a texto para que as possa reler e editar antes de enviar. Pode alternar entre escrita e voz a qualquer momento.',
      },
      isItFree: {
        question: 'É gratuito?',
        answer: 'Começa com 50 mensagens gratuitas, sem precisar de introduzir um cartão. Não há limite de tempo, pode usá-las quando o momento importar.',
      },
      afterFreeMessages: {
        question: 'O que acontece depois das minhas 50 mensagens gratuitas?',
        answer: 'Se quiser continuar, pode escolher uma subscrição — Essential ou Extended — ou adicionar um reforço pontual. Não há pressão para escolher, e nada acontece automaticamente.',
      },
      essentialVsExtended: {
        question: 'Qual é a diferença entre Essential e Extended?',
        answer: 'Os dois planos oferecem diferentes pacotes mensais de mensagens. Pode ver os detalhes actuais, os preços e mudar de plano a qualquer momento na sua página de Conta.',
      },
      whatIsTopUp: {
        question: 'O que é um reforço?',
        answer: 'Um reforço acrescenta 200 mensagens extra de uma só vez, em cima do plano que tiver. É totalmente opcional e nunca lhe será cobrado automaticamente.',
      },
      willIBeCharged: {
        question: 'Vou ser cobrado automaticamente?',
        answer: 'As subscrições renovam-se num ciclo regular até cancelar, e é sempre avisado antes de cada renovação. Os reforços são pontuais e nunca são cobrados automaticamente. Pode cancelar uma subscrição a qualquer momento.',
      },
      howToCancel: {
        question: 'Como cancelo a minha subscrição?',
        answer: 'Pode cancelar a qualquer momento na sua página de Conta. Mantém o acesso até ao fim do período já pago e depois não voltará a ser cobrado.',
      },
      isPrivate: {
        question: 'A minha informação é privada?',
        answer: 'Sim. Recolhemos o mínimo possível — não é preciso nome nem morada para usar MiniMind. As suas conversas são guardadas em privado e protegidas em conformidade com a lei britânica de protecção de dados.',
      },
      whoCanSee: {
        question: 'Quem pode ver as minhas conversas?',
        answer: 'As suas conversas são suas. São guardadas em privado de modo a que só você possa aceder através da sua conta, e nunca são partilhadas ou vendidas.',
      },
      retention: {
        question: 'Durante quanto tempo guardam as minhas conversas?',
        answer: 'As suas mensagens são guardadas até 12 meses a partir da última actividade, sendo depois apagadas automaticamente. Também pode apagá-las você mesmo antes, a qualquer momento. Guardamos ainda um breve resumo dos padrões que partilha, usado para personalizar a experiência entre sessões, enquanto a sua conta se mantiver activa.',
      },
      canDelete: {
        question: 'Posso apagar os meus dados?',
        answer: 'Sim. Pode apagar as conversas a qualquer momento nas definições da conta, e pode apagar a sua conta e todos os dados associados — incluindo o resumo guardado — quando quiser. Após um pedido de eliminação, os seus dados são apagados de forma permanente em 30 dias. Também pode escrever-nos para support@mindreset.ai para o ajudarmos.',
      },
      medicalAdvice: {
        question: 'MiniMind pode dar conselhos médicos ou de saúde mental?',
        answer: 'Não. MiniMind não diagnostica, não trata e não dá conselhos médicos ou clínicos. É um espaço para reflexão pessoal. Para qualquer assunto clínico, fale com um profissional qualificado.',
      },
      crisisHelp: {
        question: 'O que devo fazer se estou em crise ou me sinto inseguro?',
        answer: 'MindReset não é um serviço de crise. Se estiver em perigo imediato, ligue para os serviços de emergência locais (999 no Reino Unido). Se está a passar por um momento difícil e precisa de falar com alguém agora, pode ligar gratuitamente para Samaritans pelo 116 123 (Reino Unido), a qualquer hora, dia e noite.',
      },
      ageRequirement: {
        question: 'Há uma idade mínima para usar MindReset?',
        answer: 'Sim. MindReset é para adultos com 18 anos ou mais.',
      },
      languages: {
        question: 'Que idiomas suporta MindReset?',
        answer: 'MindReset está disponível em vários idiomas, sendo o inglês e o russo as nossas línguas principais. Pode mudar de idioma nas definições da sua conta.',
      },
      mobileUse: {
        question: 'Posso usar MindReset no telemóvel?',
        answer: 'Sim. MindReset funciona no navegador web do telemóvel tal como num computador — não há nada para instalar.',
      },
      contact: {
        question: 'Como vos contacto?',
        answer: 'Pode escrever-nos para support@mindreset.ai. Faremos o nosso melhor para responder — lembre-se, porém, de que não somos um serviço de crise. Para ajuda urgente, use os contactos da pergunta anterior sobre crise.',
      },
    },
  },
};

for (const loc of LOCALES) {
  const path = `./messages/${loc}.json`;
  const bundle = JSON.parse(readFileSync(path, 'utf8'));
  bundle.Faq = FAQ[loc];
  writeFileSync(path, JSON.stringify(bundle, null, 2) + '\n');
  console.log(`wrote ${loc}.json Faq`);
}
