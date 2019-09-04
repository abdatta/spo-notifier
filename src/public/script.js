var postsElement = new Vue({
    el: '#posts',
    data: {
      posts: [],
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

$.ajax({
    url: "/posts",
    success: function(posts) {
        postsElement.posts = posts.reverse();
    },
    error: function(xhr,status,error) {
        console.log(error);
    }
});
