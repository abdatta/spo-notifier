var postsElement = new Vue({
    el: '#posts',
    data: {
      posts: [
        {
          "title": "Walmart Labs : PPT Schedule",
          "date": "Aug. 31, 2019, 9:56 p.m.",
          "body": "<p>All the students who are interested to apply for Walmart Labs must attend the PPT at&#xA0;<strong>9:00 A.M.&#xA0;</strong>in&#xA0;<strong>L-20&#xA0;</strong>on&#xA0;<strong>1st September, 2019.&#xA0;</strong></p>\n\n<p><strong>Profile: </strong>Software Engineer<br>\n<strong>Eligible Streams: </strong>B.Tech, BS, Dual Degree, M.Tech, MSc. (all departments)<br>\n<strong>Compensation: </strong>INR 21,77,600 for B.Tech and INR 23,17,400 for Dual degree, M.Tech and MSc.</p>"
        },
        {
            "title": "Walmart Labs2 : PPT Schedule",
            "date": "Aug. 31, 2019, 9:56 a.m.",
            "body": "<p>All the students who are interested to apply for Walmart Labs may attend the PPT at&#xA0;<strong>9:00 A.M.&#xA0;</strong>in&#xA0;<strong>L-20&#xA0;</strong>on&#xA0;<strong>1st September, 2019.&#xA0;</strong></p>\n\n<p><strong>Profile: </strong>Software Engineer<br>\n<strong>Eligible Streams: </strong>B.Tech, BS, Dual Degree, M.Tech, MSc. (all departments)<br>\n<strong>Compensation: </strong>INR 21,77,600 for B.Tech and INR 23,17,400 for Dual degree, M.Tech and MSc.</p>"
          }
      ],
      expanded: -1
    },
    methods: {
        toggle: function (i) {
            // `this` inside methods points to the Vue instance
            if (this.expanded === i) {
                this.expanded = -1;
                $('#post_body'+i).slideUp(500);
            } else {
                $('#post_body'+this.expanded).slideUp(500);
                this.expanded = i;
                $('#post_body'+this.expanded).slideDown(500);
            }
        }
      }
})
